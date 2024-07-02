/** @format */

import { Dirent } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as mime from "mime-types";
import { promisify } from "node:util";
import { exec, type PromiseWithChild } from "node:child_process";
import {
  S3Client,
  PutObjectCommand,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";

type PromisifiedExecType = (command: string) => PromiseWithChild<{
  stdout: string;
  stderr: string;
}>;

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY!,
    secretAccessKey: process.env.AWS_SECRET_KEY!,
  },
});

const PROJECT_ID: string = process.env.PROJECT_ID!;

/**
 * Uploads a single files to S3
 *
 * @param filePath - The path to the file to upload.
 * @param name - name of the file
 */
const uploadFile = async (fullPath: string, name: string): Promise<void> => {
  /**
   * @ERROR
   * bun return the following error when using: fs.createReadStream
   * SignatureDoesNotMatch: The request signature we calculated does not match the signature you provided.
   * Check your key and signing method.
   */

  try {
    console.log("[Uploading]", name);

    const commandInput: PutObjectCommandInput = {
      Bucket: "hostify-output-projects",
      Key: `__outputs/${PROJECT_ID}/${name}`,
      Body: await fs.readFile(fullPath),
      ContentType: mime.lookup(fullPath) as string,
    };

    const command = new PutObjectCommand(commandInput);

    await s3.send(command);
    console.log("[UPLOADED] ✅", fullPath);
  } catch (error) {
    console.log("[🔴] ERROR:", error);
  }
};

/**
 * Process directory and gets file only
 * @param dirPath - Absolute Path of the directory to get the files from
 */
const processDirectory = async (dirPath: string): Promise<void> => {
  const distDirContents: Dirent[] = await fs.readdir(dirPath, {
    withFileTypes: true,
  });

  for (const dirent of distDirContents) {
    const fullPath: string = path.join(dirPath, dirent.name);
    const relativePath: string = path.relative(distDirPath, fullPath);

    if (dirent.isDirectory()) {
      await processDirectory(fullPath);
    } else {
      await uploadFile(fullPath, relativePath);
    }
  }
};

const distDirPath: string = path.join(__dirname, "output", "dist");

(async (): Promise<void> => {
  console.log(`[⌛️] Creating build...`);

  const outDirPath: string = path.join(__dirname, "output");
  const execPromisify: PromisifiedExecType = promisify(exec);
  const { stderr, stdout } = await execPromisify(
    `cd ${outDirPath} && bun install && bun run build`
  );

  if (stderr) {
    console.log(`[❌] ERROR: ${stderr}`);
  }

  if (stdout) {
    console.log(stdout);
  }

  console.log("[DONE] Build Complete 🎉");

  await processDirectory(distDirPath);

  console.log("[FINISH] 🎉");
})();
