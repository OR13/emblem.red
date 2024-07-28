import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  return NextResponse.json({ message: 'My lungs taste the air of time blown past falling sands'  })
}