import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export async function proxy(request: NextRequest) {
    const response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) return response;

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
                for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
                for (const cookie of cookiesToSet) response.cookies.set(cookie.name, cookie.value, cookie.options);
            },
        },
    });

    const { data: { user } } = await supabase.auth.getUser();
    const isLoginRoute = request.nextUrl.pathname === '/admin/login' || request.nextUrl.pathname.startsWith('/admin/login/');
    if (!user && !isLoginRoute) {
        return NextResponse.redirect(new URL('/admin/login', request.url));
    }

    if (user && !isLoginRoute) {
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceRoleKey) return NextResponse.redirect(new URL('/admin/login?error=configuration', request.url));

        // Use the server-only key here because admin_users is intentionally not
        // readable through anonymous/public policies.
        const adminClient = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });
        const { data: admin, error: adminError } = await adminClient
            .from('admin_users')
            .select('id, is_active')
            .eq('id', user.id)
            .maybeSingle();
        let adminProfile = admin;
        if (adminError) {
            const legacyResult = await adminClient
                .from('admin_users')
                .select('id')
                .eq('id', user.id)
                .maybeSingle();
            adminProfile = legacyResult.data ? { ...legacyResult.data, is_active: true } : null;
        }
        if (!adminProfile || adminProfile.is_active === false) {
            return NextResponse.redirect(new URL('/admin/login?error=unauthorized', request.url));
        }
    }

    return response;
}

export const config = {
    matcher: ['/admin/:path*'],
};
