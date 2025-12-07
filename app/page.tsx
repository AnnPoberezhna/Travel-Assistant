import Link from 'next/link'; 
import { buttonVariants } from "./components/ui/button";
import User from './components/User';
import { getServerSession } from 'next-auth';
import { authOptions } from './lib/auth';

export default async function Home () {
  const session = await getServerSession(authOptions)

  return(
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <h1 className='text-4xl'>Home</h1>
      <div style={{ display: "flex", gap: 12 }}>
        <Link className={buttonVariants()} href='/admin'>
          Open Admin Page
        </Link>
        <Link className={buttonVariants()} href='/search'>
          Open Search Page
        </Link>
      </div>
    
      {/* For Tracking the sessions */}
      
      {/* <h2>Client Session</h2>
      <User />
      <h2>Server Session</h2>
      {JSON.stringify(session)} */}
    </div>
  );
}