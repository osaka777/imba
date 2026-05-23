import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions, getAllowedEmails } from '@/lib/auth-options'

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const email = session.user.email.toLowerCase()
  const allowed = getAllowedEmails()

  if (!allowed.includes(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const token = process.env.SUPERUSER_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  return NextResponse.json({ token, email })
}
