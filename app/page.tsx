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
          <Link href="/admin" prefetch>
            <button style={{ padding: "10px 16px", borderRadius: 8, background: "#0f172a", color: "#fff", border: "none", cursor: "pointer" }}>
              Open Admin Page
            </button>
          </Link>
          <Link href="/search" prefetch>
            <button style={{ padding: "10px 16px", borderRadius: 8, background: "#0f172a", color: "#fff", border: "none", cursor: "pointer" }}>
              Open Search Page
            </button>
          </Link>
          <Link href="/history" prefetch>
            <button style={{ padding: "10px 16px", borderRadius: 8, background: "#0f172a", color: "#fff", border: "none", cursor: "pointer" }}>
              Open History Page
            </button>
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