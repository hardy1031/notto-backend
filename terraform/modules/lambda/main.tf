# =============================================================================
# Execution Role: aws_iam_role.this
#   Attached policies:
#   - AWSLambdaBasicExecutionRole (managed) : CloudWatch Logs への書き込み
#   - aws_iam_role_policy.s3_access         : S3 バケットの読み書き・削除・一覧
#   - aws_iam_role_policy.ssm_access        : SSM Parameter Store からの env var 取得
# =============================================================================

data "aws_iam_policy_document" "assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "this" {
  name               = "${var.function_name}-exec-${var.environment}"
  assume_role_policy = data.aws_iam_policy_document.assume_role.json
}

# CloudWatch Logs への書き込み (AWS managed policy)
resource "aws_iam_role_policy_attachment" "basic_execution" {
  role       = aws_iam_role.this.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# S3 バケットの読み書き・削除・一覧
data "aws_iam_policy_document" "s3_access" {
  statement {
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:ListBucket",
    ]
    resources = [
      var.s3_bucket_arn,
      "${var.s3_bucket_arn}/*",
    ]
  }
}

resource "aws_iam_role_policy" "s3_access" {
  name   = "s3-access"
  role   = aws_iam_role.this.id
  policy = data.aws_iam_policy_document.s3_access.json
}

# SSM Parameter Store からの env var 取得 (/notto/{env}/*)
data "aws_iam_policy_document" "ssm_access" {
  statement {
    effect = "Allow"
    actions = [
      "ssm:GetParameter",
      "ssm:GetParameters",
    ]
    resources = ["arn:aws:ssm:*:*:parameter/notto/${var.environment}/*"]
  }
}

resource "aws_iam_role_policy" "ssm_access" {
  name   = "ssm-access"
  role   = aws_iam_role.this.id
  policy = data.aws_iam_policy_document.ssm_access.json
}

# =============================================================================
# SSM パラメータ (env var として Lambda に渡す値)
# =============================================================================

data "aws_ssm_parameter" "supabase_url" {
  name = "/notto/${var.environment}/supabase_url"
}

data "aws_ssm_parameter" "supabase_anon_key" {
  name = "/notto/${var.environment}/supabase_anon_key"
}

data "aws_ssm_parameter" "supabase_service_role_key" {
  name = "/notto/${var.environment}/supabase_service_role_key"
}

data "aws_ssm_parameter" "gemini_api_key" {
  name = "/notto/${var.environment}/gemini_api_key"
}

# =============================================================================
# Lambda Function
# =============================================================================

resource "aws_lambda_function" "this" {
  function_name = "${var.function_name}-${var.environment}"
  role          = aws_iam_role.this.arn

  # The actual code is deployed by the CD pipeline (esbuild → zip → aws lambda update-function-code).
  # This placeholder zip is only used on the very first `terraform apply`.
  filename = "${path.module}/placeholder.zip"
  handler  = "index.handler"
  runtime  = "nodejs22.x"

  memory_size = var.memory_size
  timeout     = var.timeout

  environment {
    variables = merge(var.environment_variables, {
      SUPABASE_URL              = data.aws_ssm_parameter.supabase_url.value
      SUPABASE_ANON_KEY         = data.aws_ssm_parameter.supabase_anon_key.value
      SUPABASE_SERVICE_ROLE_KEY = data.aws_ssm_parameter.supabase_service_role_key.value
      GEMINI_API_KEY            = data.aws_ssm_parameter.gemini_api_key.value
    })
  }

  lifecycle {
    # Prevent Terraform from reverting code deployed by the CD pipeline
    ignore_changes = [filename, source_code_hash]
  }
}

# Function URL + Resource-based policy
#   authorization_type = "NONE" : 認証不要、誰でも呼び出し可能
#   Terraform が自動で FunctionURLAllowPublicAccess policy を付与する
resource "aws_lambda_function_url" "this" {
  function_name      = aws_lambda_function.this.function_name
  authorization_type = "NONE"
}
