import { prisma } from "../prisma/index.js";
import { crypto } from "../utils/crypto.js";
import { mailer } from "../utils/mailer.js";
import { CustomError } from "../utils/custom-error.js";
import { bcrypt } from "../utils/bcrypt.js";
import jwt from "jsonwebtoken";

class TeamMemberService {
    create = async (adminId, input) => {
        const inviteToken = crypto.createToken();
        const hashedInviteToken = crypto.hash(inviteToken);

        const teamMember = await prisma.teamMember.create({
            data: {
                ...input,
                adminId: adminId,
                inviteToken: hashedInviteToken
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                position: true,
                joinDate: true,
                email: true,
                status: true
            }
        });

        await mailer.sendCreatePasswordInviteToTeamMember(
            input.email,
            inviteToken
        );
        return teamMember;
    };

    createPassword = async (inviteToken, password, email) => {
        const hashedInviteToken = crypto.hash(inviteToken);
        const hashedPassword = await bcrypt.hash(password);

        const teamMember = await prisma.teamMember.findFirst({
            where: {
                inviteToken: hashedInviteToken
            }
        });
        if (!teamMember) {
            throw new CustomError("Invalid Token", 400);
        }

        await prisma.teamMember.update({
            where: {
                email: email.toLowerCase()
            },
            data: {
                password: hashedPassword,
                status: "ACTIVE",
                inviteToken: null
            }
        });
    };

    getAll = async (adminId) => {
        const teamMembers = await prisma.teamMember.findMany({
            where: {
                adminId: adminId
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                position: true,
                status: true,
                joinDate: true
            }
        });
        return teamMembers;
    };

    changeStatus = async (adminId, teamMemberId, status) => {
        const teamMember = await prisma.teamMember.findFirst({
            where: {
                id: teamMemberId
            }
        });
        if (!teamMember) {
            throw new CustomError(
                `Team member does not exist with following id ${teamMemberId}`,
                404
            );
        }

        if (teamMember.adminId !== adminId) {
            throw new CustomError(
                "Forbidden: You are not authorized to perform this action",
                403
            );
        }

        if (teamMember.status === "INACTIVE") {
            throw new CustomError(
                "Status Change is now allowed. Users with INACTIVE status can be deleted only!",
                403
            );
        }

        await prisma.teamMember.update({
            where: {
                adminId: adminId,
                id: teamMemberId
            },
            data: {
                status: status
            }
        });
    };
    isTeamMemberBelongsToAdmin = async (id, adminId) => {
        const teamMember = await prisma.teamMember.findUnique({
            where: {
                id
            }
        });

        if (!teamMember) {
            throw new CustomError("Team member does not exist", 404);
        }

        if (teamMember.adminId !== adminId) {
            throw new CustomError(
                "Forbidden: You are not authorized to perform this action",
                403
            );
        }
    };

    login = async (email, password) => {
        const teamMember = await prisma.teamMember.findUnique({
            where: {
                email: email.toLowerCase()
            },
            select: {
                id: true,
                status: true,
                password: true,
                adminId: true,
                firstName: true,
                lastName: true
            }
        });
        if (!teamMember) throw new CustomError("User does not exist", 404);

        if (teamMember.status === "INACTIVE" && !teamMember.password) {
            const inviteToken = crypto.createToken();
            const hashedInviteToken = crypto.hash(inviteToken);

            await prisma.teamMember.update({
                where: {
                    email: email
                },
                data: {
                    inviteToken: hashedInviteToken
                }
            });
            await mailer.sendCreatePasswordInviteToTeamMember(
                email,
                inviteToken
            );

            throw new CustomError(
                "You did not set up the password yet. We just emailed an instruction.",
                400
            );
        }

        if (teamMember.status === "INACTIVE" && teamMember.password) {
            "Your account has INACTIVE status, can not log in", 400;
        }

        const isPasswordMatches = await bcrypt.compare(
            password,
            teamMember.password
        );
        if (!isPasswordMatches) {
            throw new CustomError("Invalid Credentials", 401);
        }
        const projects = await prisma.teamMemberProject.findMany({
            where: {
                teamMemberId: teamMember.id,
                status: "ACTIVE"
            },
            select: {
                projectId: true
            }
        });
        const projectIds = projects.map((project) => project.projectId);

        const token = jwt.sign(
            {
                teamMember: {
                    id: teamMember.id,
                    adminId: teamMember.adminId
                }
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "2days"
            }
        );
        const teamMemberWithoutPassword = {
            firstName: teamMember.firstName,
            lastName: teamMember.lastName
        };
        return { token, projectIds, me: teamMemberWithoutPassword };
    };

    getMe = async (id) => {
        const teamMember = await prisma.teamMember.findUnique({
            where: {
                id
            },
            select: {
                firstName: true,
                lastName: true,
                position: true,
                status: true,
                email: true,
                id: true,
                adminId: true
            }
        });

        if (!teamMember) {
            throw new CustomError("Team member does not exist", 404);
        }

        return { ...teamMember, role: "teamMember" };
    };

    forgotPassword = async (email) => {
        const teamMember = await prisma.teamMember.findFirst({
            where: {
                email
            },
            select: {
                id: true
            }
        });

        if (!teamMember) {
            throw new CustomError(
                "Team member does not exist with provided email",
                404
            );
        }

        const passwordResetToken = crypto.createToken();
        const hashedPasswordResetToken = crypto.hash(passwordResetToken);

        await prisma.teamMember.update({
            where: {
                id: teamMember.id
            },
            data: {
                passwordResetToken: hashedPasswordResetToken,
                passwordResetTokenExpirationDate: date.addMinutes(10)
            }
        });

        await mailer.sendPasswordResetToken(email, passwordResetToken);
    };

    resetPassword = async (token, password) => {
        const hashedPasswordResetToken = crypto.hash(token);
        const teamMember = await prisma.teamMember.findFirst({
            where: {
                passwordResetToken: hashedPasswordResetToken
            },
            select: {
                id: true,
                passwordResetToken: true,
                passwordResetTokenExpirationDate: true
            }
        });

        if (!teamMember) {
            throw new CustomError("Invalid Token", 404);
        }

        const currentTime = new Date();
        const tokenExpDate = new Date(admin.passwordResetTokenExpirationDate);

        if (tokenExpDate < currentTime) {
            // Token Expired;
            throw new CustomError("Password Reset Token Expired");
        }

        await prisma.teamMember.update({
            where: {
                id: teamMember.id
            },
            data: {
                password: await bcrypt.hash(password),
                passwordResetToken: null,
                passwordResetTokenExpirationDate: null
            }
        });
    };

    changePassword = async (teamMemberId, input) => {
        const teamMember = await prisma.teamMember.findUnique({
            where: {
                id: teamMemberId
            },
            select: {
                password: true
            }
        });

        if (!teamMember) {
            throw new CustomError("Team member does not exist", 404);
        }

        const hashedPassword = await bcrypt.hash(input.newPassword);
        const passwordMatch = await bcrypt.compare(
            hashedPassword,
            teamMember.password
        );

        if (!passwordMatch) {
            throw new CustomError("Invalid Credentials", 400);
        }

        await prisma.teamMember.update({
            where: {
                id: teamMemberId
            },
            data: {
                password: hashedPassword
            }
        });
    };

    delete = async (adminId, teamMemberId) => {
        const teamMember = await prisma.teamMember.findUnique({
            where: {
                id: teamMemberId
            }
        });

        if (!teamMember) {
            throw new CustomError(
                `Team member does not exist with following id ${teamMemberId}`,
                404
            );
        }

        if (teamMember.adminId !== adminId) {
            throw new CustomError(
                "Forbidden: You are not authorized to perform this action",
                403
            );
        }

        if (
            teamMember.status === "ACTIVE" ||
            teamMember.status === "DEACTIVATED"
        ) {
            throw new CustomError(
                "Only users with INACTIVE status can be deleted!",
                404
            );
        }
        await prisma.teamMember.delete({
            where: {
                id: teamMemberId
            }
        });
    };

    update = async(adminId, teamMemberId, updateData) => {
        await prisma.teamMember.update({
            where: {
                id: teamMemberId,
                adminId: adminId
            },
            data: {
                ...updateData
            }
        })
    }
}

export const teamMemberService = new TeamMemberService();
