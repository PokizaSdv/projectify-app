import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { projectController } from "../controllers/project.controller.js";

const projectRouter = Router();

projectRouter.post(
    "/contributors/add",
    authMiddleware.authenticate,
    projectController.addContributor
);

projectRouter.patch(
    "/contributors/deactivate",
    authMiddleware.authenticate,
    projectController.deactivateContributor
);

projectRouter.patch(
    "/contributors/reactivate",
    authMiddleware.authenticate,
    projectController.reactivateContributor
);

projectRouter.post("/", authMiddleware.authenticate, projectController.create);
projectRouter.get(
    "/:id",
    authMiddleware.authenticate,
    projectController.getOne
);

projectRouter.patch(
    "/:id",
    authMiddleware.authenticate,
    projectController.update
);
projectRouter.get("/", authMiddleware.authenticate, projectController.getAll);

projectRouter.patch(
    "/:id/archive",
    authMiddleware.authenticate,
    projectController.archive
);
projectRouter.patch(
    "/:id/reactivate",
    authMiddleware.authenticate,
    projectController.reactivate
);

export { projectRouter };