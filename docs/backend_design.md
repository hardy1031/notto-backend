# Notto Backend Design

Backend server (Hono / TypeScript / Bun) の設計ドキュメント。

詳細な API 仕様 → [Notto-docs/docs/api_design.md](../Notto-docs/docs/api_design.md)
システム全体像 → [Notto-docs/docs/system_architecture.md](../Notto-docs/docs/system_architecture.md)

---

## 設計の考え方

```
Business Logic   →   Use Case         →   Endpoint
(何ができるか)        (どう組み合わせるか)     (どう呼ぶか)
```

- **Business Logic** : ドメインのルールそのもの。ユーザー・ノート・クイズ・AI 解釈など、アプリが持つ本質的な能力
- **Use Case** : ビジネスロジックを組み合わせて、ひとつのユーザー意図を実現するフロー。複数のロジックを順番・条件付きで呼ぶ
- **Endpoint** : HTTP リクエストを受け取り、Use Case を呼び出し、レスポンスを返す。ロジックは持たない

---

## Business Logic（何ができるか）

### Auth

| ロジック | 概要 |
|---------|------|
| `createUser` | Supabase Auth にユーザーを作成し、`users` テーブルにプロフィールを追加する |
| `authenticateUser` | Supabase Auth で認証し、JWT を発行する |
| `verifyToken` | JWT を検証してユーザー ID を取得する（Supabase Auth API に委譲） |

### Notebook / Note

| ロジック | 概要 |
|---------|------|
| `findOrCreateNotebook` | クライアントの UUID を使ってノートブックを作成 or 既存を返す |
| `upsertNote` | ノートを作成 or 更新する。`updated_at` で新旧を判断する |
| `uploadNoteToS3` | ノートの本文を S3 にアップロードし、`s3_key` を返す |
| `getNoteContent` | S3 からノート本文を取得する |

### Context Object

| ロジック | 概要 |
|---------|------|
| `interpretNotes` | AI API にノート本文を送り、Context Object（表現・ニュアンス・トーン・例文など）を生成する |
| `replaceContextObjects` | ノートが更新された際、そのノートに紐づく Context Object と Quiz を全て置き換える |
| `bulkCreateContextObjects` | 生成された Context Object を DB に一括保存する |

### Quiz

| ロジック | 概要 |
|---------|------|
| `generateQuizzes` | Context Object から Quiz を生成する（AI API 経由）|
| `bulkCreateQuizzes` | 生成された Quiz を DB に一括保存する |

### Quiz Run

| ロジック | 概要 |
|---------|------|
| `saveQuizRun` | Quiz Run と全 Quiz Record を DB に保存する |

### User Data

| ロジック | 概要 |
|---------|------|
| `fetchAllUserData` | ユーザーに紐づく全データ（Notebook / Note / Context Object / Quiz / Quiz Run / Quiz Record）を取得する |

### AI Learn

| ロジック | 概要 |
|---------|------|
| `askAI` | Context Object と質問文を AI API に送り、深掘り説明・例文・関連表現を返す（DB に保存しない）|

---

## Use Case（どう組み合わせるか）

### `RegisterUseCase`

ユーザー登録。

```
1. createUser (Supabase Auth + users テーブル)
2. JWT を返す
```

### `LoginUseCase`

ログイン。

```
1. authenticateUser (Supabase Auth)
2. JWT を返す
```

### `SyncUseCase`

クライアントが持つ Notebook / Note をサーバーと同期する。

```
1. findOrCreateNotebook × notebooks
2. upsertNote × notes
   ├─ 新規 or updated_at が新しい → uploadNoteToS3 → DB に s3_key 保存
   └─ 同じ updated_at → スキップ
3. 新規 or 更新されたノートの ID を返す
```

同期ルール：

| サーバーの状態 | クライアントの送信 | 処理 |
|-------------|-----------------|------|
| 存在しない | Notebook | 作成 |
| 存在する・同じ `updated_at` | Notebook | スキップ |
| 存在する・クライアントが新しい | Notebook | 更新 |
| 存在しない | Note | 作成 + S3 アップロード |
| 存在する・同じ `updated_at` | Note | スキップ（再生成なし）|
| 存在する・クライアントが新しい | Note | 更新 + S3 再アップロード + 再生成フラグ |

### `GenerateQuizzesUseCase`

新規・更新ノートから Context Object と Quiz を生成して保存する。

```
1. getNoteContent（S3 から本文取得）
2. interpretNotes（AI API → Context Object 生成）
3. generateQuizzes（AI API → Quiz 生成）
4. replaceContextObjects（更新ノートの場合は旧データを削除）
5. bulkCreateContextObjects
6. bulkCreateQuizzes
7. 生成結果を返す
```

`POST /sync` では この後に `GetUserDataUseCase` を続けて呼び、レスポンスに最新の全ユーザーデータを含める。クライアントはこの1レスポンスでローカル SQLite を最新状態にできる。

### `SubmitQuizRunUseCase`

クライアントから送られたクイズ結果をサーバーに保存する。

```
1. quiz_id の存在確認（ユーザーが所有しているか）
2. saveQuizRun（Quiz Run + Quiz Record を保存）
3. 保存結果を返す
```

> 正誤判定はクライアントが行う。サーバーは `is_correct` をそのまま信頼して保存する。

### `GetUserDataUseCase`

クライアント起動時のバックグラウンド同期用。

```
1. verifyToken（JWT → user_id）
2. fetchAllUserData（include パラメータでフィルタ可能）
3. フラット配列で返す（クライアントが FK で関係を復元する）
```

### `LearnUseCase`

表現について AI に深掘り質問する（トランジェント、DB 保存なし）。

```
1. context_object_id で Context Object を取得（user_id で所有確認）
2. askAI（Context Object + 質問文 → AI API）
3. explanation / examples / related_expressions を返す
```

---

## Endpoint（どう呼ぶか）

| Method | Path | Use Case | Auth |
|--------|------|----------|------|
| POST | `/auth/register` | `RegisterUseCase` | 不要 |
| POST | `/auth/login` | `LoginUseCase` | 不要 |
| GET | `/me` | `GetUserDataUseCase` | JWT |
| POST | `/quizzes` | `SyncUseCase` → `GenerateQuizzesUseCase` → `GetUserDataUseCase` | JWT |
| POST | `/quiz-runs` | `SubmitQuizRunUseCase` | JWT |
| POST | `/learn` | `LearnUseCase` | JWT |

### Endpoint の責務

Endpoint はロジックを持たず、以下のみを行う：

1. リクエストをパース・バリデーション
2. JWT を検証して `user_id` を取得（認証付きエンドポイント）
3. Use Case を呼び出す
4. Use Case の結果を HTTP レスポンスに変換する

---

## ディレクトリ構成（予定）

```
src/
  routes/           # Endpoint 定義（Hono ルーター）
    auth.ts
    me.ts
    quizzes.ts
    quizRuns.ts
    learn.ts
  usecases/         # Use Case
    RegisterUseCase.ts
    LoginUseCase.ts
    SyncUseCase.ts
    GenerateQuizzesUseCase.ts
    SubmitQuizRunUseCase.ts
    GetUserDataUseCase.ts
    LearnUseCase.ts
  domain/           # Business Logic（純粋な関数 or クラス）
    auth/
    notebook/
    note/
    contextObject/
    quiz/
    quizRun/
    learn/
  repositories/     # DB アクセス（PostgreSQL / SQLite の差を吸収）
    notebookRepository.ts
    noteRepository.ts
    contextObjectRepository.ts
    quizRepository.ts
    quizRunRepository.ts
  infrastructure/   # 外部サービスのクライアント
    s3Client.ts
    aiClient.ts
    supabaseClient.ts
  middleware/
    auth.ts         # JWT 検証ミドルウェア
  index.ts          # エントリーポイント
```

---

## エラーレスポンス形式

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description",
    "details": {}
  }
}
```

| Code | Status | 用途 |
|------|--------|------|
| `VALIDATION_ERROR` | 400 | バリデーション失敗 |
| `UNAUTHORIZED` | 401 | JWT なし or 無効 |
| `NOT_FOUND` | 404 | リソースが見つからない |
| `CONFLICT` | 409 | 重複（メール登録済みなど） |
| `AI_UNAVAILABLE` | 503 | AI API タイムアウト or 障害 |

---

## 設計上の主な判断

| 判断 | 理由 |
|------|------|
| `POST /quizzes/generate` に Sync・Generate・データ返却をまとめる | クライアントから見て「クイズを作る」はひとつの操作。Push と Pull を1回で済ませる |
| クライアントが Notebook / Note の UUID を生成する | オフラインで作成されるため、サーバー到達前に ID が必要 |
| サーバーが Context Object / Quiz / Quiz Run の UUID を生成する | サーバーサイドで生成される成果物なので、サーバーが ID を管理 |
| `is_correct` をクライアント評価・サーバー信頼 | 正誤判定ロジックはクライアントの責務。サーバーはストレージに徹する |
| `POST /learn` の結果は DB 保存しない | 会話型 AI のやり取りを永続化すると容量が膨らむ。必要ならクライアントがローカルにキャッシュ |
| `GET /me` はフラット配列で返す | クライアントがそのまま SQLite テーブルに INSERT しやすい形式 |
