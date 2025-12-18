import Link from 'next/link';
import { Button, buttonVariants } from './ui/button';
import { HandMetal } from 'lucide-react';
import { authOptions } from '../lib/auth';
import { getServerSession } from 'next-auth';
import { signOut } from 'next-auth/react';
import UserAccountnav from './UserAccountnav';

const Navbar = async () => {
  const session = await getServerSession(authOptions);


  return (
    <div className=' bg-zinc-100 py-0.5 border-b border-s-zinc-200 fixed w-full z-10 top-0'>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', width: '100%' }}>
        <Link href='/'>
          <HandMetal />
        </Link>
        {session?.user ? (
          <UserAccountnav />
        ) : (
            <Link className={buttonVariants()} href='/sign-in'>
              Sign in
            </Link>
        )}
      </div>
    </div>
  );
};

export default Navbar;