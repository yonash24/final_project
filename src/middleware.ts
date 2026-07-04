import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function middleware(request: NextRequest) {
    const response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            get(name: string) {
                return request.cookies.get(name)?.value;
            },
            set(name: string, value: string, options) {
                request.cookies.set({ name, value, ...options });
                response.cookies.set({ name, value, ...options });
            },
            remove(name: string, options) {
                request.cookies.set({ name, value: '', ...options });
                response.cookies.set({ name, value: '', ...options });
            },
        },
    });

    const isLoginPage = request.nextUrl.pathname === '/admin/login';
    const isAdminRoute = request.nextUrl.pathname.startsWith('/admin');
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (isAdminRoute && !isLoginPage) {
        if (!user) {
            return NextResponse.redirect(new URL('/admin/login', request.url));
        }

        const { data: adminProfile } = await supabase
            .from('admin_users')
            .select('id')
            .eq('id', user.id)
            .maybeSingle();

        if (!adminProfile) {
            const url = new URL('/admin/login', request.url);
            url.searchParams.set('error', 'unauthorized');
            return NextResponse.redirect(url);
        }
    }

    if (isLoginPage && user) {
        return NextResponse.redirect(new URL('/admin', request.url));
    }

    return response;
}

export const config = {
    matcher: ['/admin/:path*'],
};
