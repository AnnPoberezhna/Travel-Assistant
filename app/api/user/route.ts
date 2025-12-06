import { db } from "@/app/lib/db";
import { NextResponse } from "next/server";
import { hash } from 'bcrypt';
import * as z from 'zod'

// Define schema for input validation
const userSchema = z
  .object({
    username: z.string().min(1, 'Username is required').max(100),
    email: z.string().min(1, 'Email is required').email('Invalid email'),
    password: z
      .string()
      .min(1, 'Password is required')
      .min(8, 'Password must have than 8 characters'),
    //confirmPassword: z.string().min(1, 'Password confirmation is required'),
  })
//   .refine((data) => data.password === data.confirmPassword, {
//     path: ['confirmPassword'],
//     message: 'Password do not match',
//   });

export async function POST(req: Request) {
    try{
        const body = await req.json();
        const {email, username, password} = userSchema.parse(body);

        // check if email already exists
        const exisitingUserByEmail = await db.user.findUnique({where: { email: email}});
        if(exisitingUserByEmail) {
            return NextResponse.json({user: null, message: "User with this email already exists"},
                {status: 409}
            )
        }

        // check if username already exists
        const exisitingUserByUsername = await db.user.findUnique({where: { username: username}});
        if(exisitingUserByUsername) {
            return NextResponse.json({user: null, message: "User with this username already exists"},
                {status: 409}
            )
        }   
        
        const hashedPassword = await hash(password, 10);
        const newUser = await db.user.create({data: {
            username,
            email,
            password: hashedPassword
        }});
        const {password: newUserPassword, ...rest} = newUser;

        return NextResponse.json({user: rest, message: "User created successfully"}, {status: 201});
    } catch(error){
        return NextResponse.json({message: "Something went worng"}, {status: 500});
    }
}