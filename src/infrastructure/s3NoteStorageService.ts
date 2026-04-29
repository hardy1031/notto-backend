import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { S3Error } from "../errors/index.ts"
import type { NoteStorageService } from "../usecases/NoteStorageService.ts"

function createClient() {
  const region = process.env.AWS_REGION
  const endpoint = process.env.AWS_ENDPOINT

  if (!region) {
    throw new Error("Missing AWS environment variable: AWS_REGION")
  }

  // credentials は渡さない。SDK のデフォルト credential chain に任せる。
  // - Lambda: IAM ロールの一時クレデンシャル（ACCESS_KEY + SECRET + SESSION_TOKEN）を自動使用
  // - ローカル: AWS_ENDPOINT が指定されている場合は LocalStack 等に接続
  return new S3Client({
    region,
    ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
  })
}

function getBucket() {
  const bucket = process.env.S3_BUCKET_NAME
  if (!bucket) throw new Error("Missing AWS environment variable: S3_BUCKET_NAME")
  return bucket
}

export class S3NoteStorageService implements NoteStorageService {
  private readonly client: S3Client
  private readonly bucket: string

  constructor() {
    this.client = createClient()
    this.bucket = getBucket()
  }

  async upload(s3Key: string, content: string): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: s3Key,
          Body: content,
          ContentType: "application/json",
        })
      )
    } catch (err) {
      throw new S3Error(`Failed to upload ${s3Key}: ${String(err)}`)
    }
  }

  async fetch(s3Key: string): Promise<string> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: s3Key })
      )
      if (!response.Body) throw new Error("Empty response body")
      return await response.Body.transformToString()
    } catch (err) {
      throw new S3Error(`Failed to fetch ${s3Key}: ${String(err)}`)
    }
  }

  async deleteAllForUser(userId: string): Promise<void> {
    try {
      const prefix = `${userId}/`
      let continuationToken: string | undefined

      do {
        const listResponse = await this.client.send(
          new ListObjectsV2Command({
            Bucket: this.bucket,
            Prefix: prefix,
            ContinuationToken: continuationToken,
          })
        )

        const objects = listResponse.Contents ?? []

        if (objects.length > 0) {
          await this.client.send(
            new DeleteObjectsCommand({
              Bucket: this.bucket,
              Delete: {
                Objects: objects.map((obj) => ({ Key: obj.Key! })),
                Quiet: true,
              },
            })
          )
        }

        continuationToken = listResponse.IsTruncated
          ? listResponse.NextContinuationToken
          : undefined
      } while (continuationToken)
    } catch (err) {
      throw new S3Error(`Failed to delete objects for user ${userId}: ${String(err)}`)
    }
  }
}
