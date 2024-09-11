/** @format */

import { Redis } from "ioredis";
import { Server } from "socket.io";
import { generateSlug } from "random-word-slugs";
import express, { type Express, type Response, type Request } from "express";
import {
  ECSClient,
  RunTaskCommand,
  type RunTaskCommandInput,
} from "@aws-sdk/client-ecs";

const app: Express = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT: string = process.env.PREVERSE_PROXY ?? "9000";

/**
 * AWS Config
 */
const ecsClient = new ECSClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY!,
    secretAccessKey: process.env.AWS_SECRET_KEY!,
  },
});

const config = {
  CLUSTER: "arn:aws:ecs:us-east-1:533267046219:cluster/builder-cluster",
  TASK: "arn:aws:ecs:us-east-1:533267046219:task-definition/builder-task",
};

/**
 * ROUTE
 */
app.post("/new", async (req: Request, res: Response) => {
  const { gitURL, name } = req.body as { gitURL: string; name?: string };

  const projectSlug: string = name ?? generateSlug();

  if (!gitURL) return res.status(400).json({ message: "git url is required" });

  const command: RunTaskCommandInput = {
    cluster: config.CLUSTER,
    taskDefinition: config.TASK,
    launchType: "FARGATE",
    count: 1,
    networkConfiguration: {
      awsvpcConfiguration: {
        assignPublicIp: "ENABLED",
        subnets: [
          "subnet-0613278d285190b3d",
          "subnet-0da1f3785e0551d28",
          "subnet-093ab8de1f1ec1534",
          "subnet-0f66f70da6a4eeffd",
          "subnet-0199e9810ab412f60",
          "subnet-0831e653fb0bf0bc1",
        ],
        securityGroups: ["sg-01b46fc93fe0c3907"],
      },
    },
    overrides: {
      containerOverrides: [
        {
          name: "builder-image",
          environment: [
            {
              name: "GIT_REPO_URL",
              value: gitURL,
            },
            {
              name: "PROJECT_ID",
              value: projectSlug,
            },
            {
              name: "AWS_REGION",
              value: process.env.AWS_REGION!,
            },
            {
              name: "AWS_ACCESS_KEY",
              value: process.env.AWS_ACCESS_KEY!,
            },
            {
              name: "AWS_SECRET_KEY",
              value: process.env.AWS_SECRET_KEY!,
            },
            {
              name: "AWS_S3_BUCKET",
              value: process.env.AWS_S3_BUCKET!,
            },
            {
              name: "REDIS_URL",
              value: process.env.REDIS_URL!,
            },
          ],
        },
      ],
    },
  };

  await ecsClient.send(new RunTaskCommand(command));

  return res.json({
    status: "queued",
    data: { url: `http://${projectSlug}.localhost:8000`, name: projectSlug },
  });
});

/**
 * Subscriber
 */
const subscriber = new Redis(process.env.REDIS_URL!);
const io = new Server({
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  socket.on("subscribe", (channel) => {
    console.log("[Channel]", channel);
    socket.join(channel);
    socket.emit("logs", `Joined ${channel}`);
  });
});

const initRedisSubscribe = async () => {
  subscriber.psubscribe("logs:*");
  subscriber.on("pmessage", (pattern, channel, message) => {
    console.log("[pmessage]", channel);

    io.to(channel).emit("logs", message);
  });
};
initRedisSubscribe();

io.listen(9002);
app.listen(PORT, () => console.log(`API Server Running on ${PORT} 🎉`));
