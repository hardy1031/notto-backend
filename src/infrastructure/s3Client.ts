import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { S3Error } from "../errors/index.ts"
import type { NoteStorageRepository } from "../repositories/noteStorageRepository.ts"

const region = process.env.AWS_REGION
const accessKeyId = process.env.AWS_ACCESS_KEY_ID
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
const bucket = process.env.S3_BUCKET_NAME

if (!region || !accessKeyId || !secretAccessKey || !bucket) {
  throw new Error("Missing AWS environment variables")
}

const client = new S3Client({
  region,
  credentials: { accessKeyId, secretAccessKey },
})

export class S3NoteStorageRepository implements NoteStorageRepository {
  async upload(s3Key: string, content: string): Promise<void> {
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: s3Key,
          Body: content,
          ContentType: "text/markdown",
        })
      )
    } catch (err) {
      throw new S3Error(`Failed to upload ${s3Key}: ${String(err)}`)
    }
  }

  async fetch(s3Key: string): Promise<string> {
    try {
      const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: s3Key }))
      if (!response.Body) throw new Error("Empty response body")
      return await response.Body.transformToString()
    } catch (err) {
      throw new S3Error(`Failed to fetch ${s3Key}: ${String(err)}`)
    }
  }
}
