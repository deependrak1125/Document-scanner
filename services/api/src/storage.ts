import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "./config.js";
import { HttpError } from "./security.js";
export const s3 = new S3Client({
  region: config.S3_REGION,
  endpoint: config.S3_ENDPOINT,
  forcePathStyle: !!config.S3_ENDPOINT,
  credentials:
    config.S3_ACCESS_KEY && config.S3_SECRET_KEY
      ? {
          accessKeyId: config.S3_ACCESS_KEY,
          secretAccessKey: config.S3_SECRET_KEY,
        }
      : undefined,
});
export const putUrl = (key: string, size: number) =>
  getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: config.S3_BUCKET,
      Key: key,
      ContentLength: size,
      ContentType: "application/pdf",
      ServerSideEncryption: "AES256",
    }),
    { expiresIn: 900 },
  );
export const getUrl = (key: string) =>
  getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: config.S3_BUCKET,
      Key: key,
      ResponseContentType: "application/pdf",
      ResponseContentDisposition: 'attachment; filename="document.pdf"',
    }),
    { expiresIn: 300 },
  );
export const removeObject = (key: string) =>
  s3.send(new DeleteObjectCommand({ Bucket: config.S3_BUCKET, Key: key }));
export async function validatePdf(key: string, size: number) {
  const head = await s3.send(
    new HeadObjectCommand({ Bucket: config.S3_BUCKET, Key: key }),
  );
  if (head.ContentLength !== size || head.ContentType !== "application/pdf")
    throw new HttpError(
      422,
      "Uploaded file size or content type does not match.",
    );
  const bytes = await s3.send(
    new GetObjectCommand({
      Bucket: config.S3_BUCKET,
      Key: key,
      Range: "bytes=0-4",
    }),
  );
  if ((await bytes.Body?.transformToString()) !== "%PDF-")
    throw new HttpError(422, "File is not a PDF.");
  return head.ETag;
}
export async function removeUserObjects(userId: string) {
  // Always restart listing after deleting a batch: pagination markers can skip mutated keys.
  while (true) {
    const batch = await s3.send(
      new ListObjectsV2Command({
        Bucket: config.S3_BUCKET,
        Prefix: `${userId}/`,
        MaxKeys: 1000,
      }),
    );
    if (!batch.Contents?.length) break;
    const result = await s3.send(
      new DeleteObjectsCommand({
        Bucket: config.S3_BUCKET,
        Delete: { Objects: batch.Contents.map((o) => ({ Key: o.Key! })) },
      }),
    );
    if (result.Errors?.length)
      throw new Error("Some account objects could not be removed.");
  }
}

export async function copyObject(
  source: string,
  target: string,
  etag?: string,
) {
  await s3.send(
    new CopyObjectCommand({
      Bucket: config.S3_BUCKET,
      Key: target,
      CopySource: `${config.S3_BUCKET}/${source.split("/").map(encodeURIComponent).join("/")}`,
      CopySourceIfMatch: etag,
      ServerSideEncryption: "AES256",
    }),
  );
}
