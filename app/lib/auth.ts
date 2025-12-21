import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { db } from "./db";
import { compare } from "bcrypt";


export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(db),
    secret: process.env.NEXTAUTH_SECRET,
    session: {
        strategy: 'jwt'
    },
    pages: {
        signIn: '/sign-in',
    },
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email", placeholder: "jsmith@mail.com" },
                password: { label: "Password", type: "password" }
                },
            async authorize(credentials) {
                // const user = { id: "1", name: "J Smith", email: "jsmith@example.com" }
                if (!credentials?.email || !credentials?.password){
                    return null
                }

                const existingUser = await db.user.findUnique({
                    where: {email: credentials?.email}
                });
                if(!existingUser){
                    return null;
                }

                const passwordMatch = await compare(credentials.password, existingUser.password);

                if(!passwordMatch) {
                    return null;
                }

                return {
                    id: `${existingUser.id}`,
                    username: existingUser.username,
                    email: existingUser.email
                }
            }
        })
    ],

    callbacks: {
        async jwt({ token, user }) {
            if(user){
                return {
                    ...token,
                    username: user.username,
                    id: user.id
                }
            }
            
            // Fetch updated user data on subsequent requests
            if (token.email) {
                const dbUser = await db.user.findUnique({
                    where: { email: token.email as string },
                    select: { id: true, username: true, email: true, role: true }
                });
                
                if (dbUser) {
                    token.username = dbUser.username;
                    token.id = dbUser.id.toString();
                    token.role = dbUser.role;
                }
            }
            
            return token
        },

        async session({ session, user, token }) {
            return {
                ...session,
                user: {
                    ...session.user,
                    username: token.username,
                    id: token.id,
                    role: token.role
                }
            }
        },
    }
}
