import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '~/entities/user/lib';

export async function GET(request: NextRequest) {
  try {

    const token = await getSession();
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    // Формируем URL для бэкенда
    const backendUrl = process.env.NEXT_PUBLIC_HOST;
    if (!backendUrl) {
      throw new Error('NEXT_PUBLIC_HOST environment variable is required. Please set it in your .env.local file');
    }
    const url = new URL('/api/bet', backendUrl);
    if (status) {
      url.searchParams.set('status', status);
    }


    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

 
    if (!response.ok) {
      // Проверяем, не является ли ответ HTML (ошибка сервера)
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('text/html')) {
        const text = await response.text();
        return NextResponse.json(
          { 
            error: 'Backend server error', 
            details: 'Server returned HTML response instead of JSON',
            status: response.status 
          }, 
          { status: 502 }
        );
      }

      // Пытаемся получить JSON ошибки
      try {
        const errorData = await response.json();
        console.error('❌ Backend error response:', errorData);
        return NextResponse.json(errorData, { status: response.status });
      } catch {
        // Если не можем распарсить JSON, возвращаем общую ошибку
        console.error(`❌ Backend responded with status: ${response.status}`);
        return NextResponse.json(
          { error: `Backend error: ${response.status}` }, 
          { status: response.status }
        );
      }
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('❌ Unexpected content type:', contentType, 'Response:', text.substring(0, 200));
      return NextResponse.json(
        { 
          error: 'Invalid response format', 
          details: `Expected JSON but got ${contentType}` 
        }, 
        { status: 502 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('❌ Error in bet API route:', error);
    
    // Проверяем, является ли ошибка сетевой
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        { 
          error: 'Backend connection failed', 
          details: 'Unable to connect to backend server' 
        }, 
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
} 