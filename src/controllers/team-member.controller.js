import { catchAsync } from "../utils/catch-async.js";
import { CustomError } from "../utils/custom-error.js";
import { teamMemberService } from "../services/team-member.service.js";

class TeamMemberController {
    create = catchAsync(async (req, res) => {
        const { body, adminId } = req;

        const input = {
            firstName: body.firstName,
            lastName: body.lastName,
            email: body.email,
            position: body.position,
            joinDate: body.joinDate
        };

        if (
            !input.firstName ||
            !input.lastName ||
            !input.email ||
            !input.position ||
            !input.joinDate
        ) {
            throw new CustomError(
                "All fields are required: First Name, Last Name, Email, Position",
                400
            );
        }

        const teamMember = await teamMemberService.create(adminId, input);
        res.status(201).send({
            data: teamMember
        });
    });

    createPassword = catchAsync(async (req, res) => {
        const {
            headers,
            body: { password, passwordConfirm, email }
        } = req;

        if (!headers.authorization) {
            throw new CustomError("You are not logged in. Please, log in", 401);
        }
        const [prefix, token] = headers.authorization.split(" ");

        if (!prefix || !token) {
            throw new CustomError("Not Valid Token", 400);
        }

        if (!token) {
            throw new CustomError("Invite Token is missing", 400);
        }

        if (!password || !passwordConfirm || !email) {
            throw new CustomError(
                "All fields are required: Password and Password Confirmation, Email",
                400
            );
        }

        if (password !== passwordConfirm) {
            throw new CustomError(
                "Password and Password Confirmation must match",
                400
            );
        }
        await teamMemberService.createPassword(token, password, email);

        res.status(200).json({
            message: "You successfully created Password. Now, you can log in"
        });
    });

    getAll = catchAsync(async (req, res) => {
        const { adminId } = req;
        const teamMembers = await teamMemberService.getAll(adminId);

        res.status(200).json({
            data: teamMembers
        });
    });

    deactivate = catchAsync(async (req, res) => {
        const { adminId, params } = req;

        await teamMemberService.changeStatus(adminId, params.id, "DEACTIVATED");
        res.status(204).send();
    });

    reactivate = catchAsync(async (req, res) => {
        const { adminId, params } = req;
        await teamMemberService.changeStatus(adminId, params.id, "ACTIVE");

        res.status(204).send();
    });

    login = catchAsync(async (req, res) => {
        const {
            body: { email, password }
        } = req;

        if (!email || !password) {
            throw new CustomError(
                "All fields required: name and password",
                400
            );
        }

        const jwt = await teamMemberService.login(email, password);
        res.status(200).json({
            token: jwt
        });
    });

    getMe = catchAsync(async (req, res) => {
        const { teamMember } = req;
        const me = await teamMemberService.getMe(teamMember.id);

        res.status(200).json({
            data: me
        });
    });

    forgotPassword = catchAsync(async (req, res) => {
        const {
            body: { email }
        } = req;

        await teamMemberService.forgotPassword(email);
        res.status(200).json({
            message:
                "We emailed you an instruction to reset your password. Follow it!"
        });
    });

    resetPassword = catchAsync(async (req, res) => {
        const {
            body: { password, passwordConfirm },
            headers
        } = req;
        if (!password || !passwordConfirm) {
            throw new CustomError(
                "Both Password and Password Confirmation are required"
            );
        }

        if (password !== passwordConfirm) {
            throw new CustomError(
                "Password and Password Confirmation does not match",
                400
            );
        }
        if (!headers.authorization) {
            throw (new CustomError("Password Reset Token is missing"), 400);
        }
        const [bearer, token] = headers.authorization.split(" ");
        if (bearer !== "Bearer" || !token) {
            throw new CustomError("Invalid Password Reset Token", 400);
        }

        await teamMemberService.resetPassword(token, password);
        res.status(200).json({
            message: "Password successfully updated"
        });
    });

    changePassword = catchAsync(async (req, res) => {
        const { teamMember, body } = req;

        const input = {
            password: body.password,
            newPassword: body.newPassword,
            newPasswordConfirm: body.newPasswordConfirm
        };

        if (
            !input.password ||
            !input.newPassword ||
            !input.newPasswordConfirm
        ) {
            "All fields are required: Current Password and New Password, New Password Confirmation",
                400;
        }

        if (input.password === input.newPassword) {
            throw new CustomError(
                "Current Password and New password must not match!",
                400
            );
        }

        if (input.newPassword !== input.newPasswordConfirm) {
            throw new CustomError(
                "Password and Password Confirmation must match",
                400
            );
        }

        await teamMemberService.changePassword(teamMember.id, input);

        res.status(200).json({
            message: "Password successfully updated"
        });
    });

    delete = catchAsync(async (req, res) => {
        const { adminId, params } = req;
        await teamMemberService.delete(adminId, params.id);

        res.status(204).send();
    });

    update = catchAsync(async (req, res) => {
        const {
            adminId,
            params,
            body: { firstName, lastName, position, joinDate },
            body
        } = req;
        const updateData = {}
        if(firstName) {
            updateData.firstName = firstName
        }
        if(lastName) {
            updateData.lastName = lastName;
        }
        if(position) {
            updateData.position = position;
        }
        if(joinDate) {
            updateData.joinDate = joinDate
        }

        await teamMemberService.update(adminId, params.id, updateData)
        res.status(204).send()
    });
}

export const teamMemberController = new TeamMemberController();
