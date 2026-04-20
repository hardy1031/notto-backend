import postgres from "postgres"

const sql = postgres(process.env.DATABASE_URL!, { max: 1 })

export default sql
