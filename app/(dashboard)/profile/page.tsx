'use client';

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, Mail, Shield, Calendar, Star, Clock, Lock, Edit, Check, X, TrendingUp } from "lucide-react";

interface UserData {
  id: number;
  email: string;
  username: string;
  role: string;
  createdAt: string;
  favoriteRoutesCount: number;
  searchHistoryCount: number;
}

const ProfilePage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'view' | 'password' | 'edit'>('view');
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  
  // Profile edit state
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [editError, setEditError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/sign-in');
      return;
    }
    
    if (status === 'authenticated') {
      fetchUserData();
    }
  }, [status, router]);

  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/user/profile');
      if (response.ok) {
        const data = await response.json();
        setUserData(data);
        setEditUsername(data.username);
        setEditEmail(data.email);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    setPasswordError('');
    setPasswordMessage('');

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters long');
      return;
    }

    try {
      const response = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setPasswordMessage('Password changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordError(data.message || 'Failed to change password');
      }
    } catch (error) {
      setPasswordError('An error occurred. Please try again.');
    }
  };

  const handleProfileUpdate = async () => {
    setEditError('');
    setEditMessage('');

    try {
      const response = await fetch('/api/user/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: editUsername,
          email: editEmail,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setEditMessage('Profile updated successfully!');
        setUserData(prev => prev ? { ...prev, username: editUsername, email: editEmail } : null);
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        setEditError(data.message || 'Failed to update profile');
      }
    } catch (error) {
      setEditError('An error occurred. Please try again.');
    }
  };

  if (status === 'loading' || loading || !userData) {
    return (
      <div style={{ minHeight: "100vh", width: "100%", background: "#0a1929", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <User size={56} color="#42a5f5" style={{ marginBottom: 20, animation: "pulse 1s ease-in-out infinite" }} />
          <div style={{ fontSize: 20, color: "#42a5f5", fontWeight: 600 }}>Loading profile...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", width: "100%", background: "#0a1929", position: "relative", paddingBottom: "80px" }}>
      <style dangerouslySetInnerHTML={{__html: `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 100%; min-height: 100vh; background: #0a1929; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        @keyframes slideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes glow { 0%, 100% { box-shadow: 0 0 20px rgba(66, 165, 245, 0.3); } 50% { box-shadow: 0 0 40px rgba(66, 165, 245, 0.6); } }
      `}} />

      {/* Floating User Icons */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", overflow: "hidden" }}>
        <User size={70} color="#42a5f5" style={{ position: "absolute", top: "8%", left: "6%", opacity: 0.08 }} />
        <Shield size={60} color="#5c6bc0" style={{ position: "absolute", top: "20%", right: "10%", opacity: 0.06 }} />
        <User size={65} color="#42a5f5" style={{ position: "absolute", bottom: "25%", left: "8%", opacity: 0.09 }} />
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "120px 20px 40px 20px", position: "relative", zIndex: 1 }}>
        
        {/* Main Content Card */}
        <div style={{ background: "rgba(255, 255, 255, 0.98)", borderRadius: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.5)", border: "2px solid rgba(66, 165, 245, 0.2)", overflow: "hidden" }}>
          
          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "2px solid #e3f2fd" }}>
            {[
              { id: 'view', label: 'Profile Overview', icon: User },
              { id: 'edit', label: 'Edit Profile', icon: Edit },
              { id: 'password', label: 'Change Password', icon: Lock }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  flex: 1,
                  padding: "20px 24px",
                  background: activeTab === tab.id ? "linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)" : "transparent",
                  border: "none",
                  borderBottom: activeTab === tab.id ? "3px solid #42a5f5" : "3px solid transparent",
                  cursor: "pointer",
                  fontSize: 15,
                  fontWeight: 700,
                  color: activeTab === tab.id ? "#0d47a1" : "#78909c",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  transition: "all 0.2s ease"
                }}
              >
                <tab.icon size={18} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div style={{ padding: 40 }}>
            {activeTab === 'view' && (
              <div style={{ animation: "slideIn 0.3s ease-out" }}>
                <h2 style={{ fontSize: 24, fontWeight: 800, color: "#1565c0", marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}>
                  <TrendingUp size={28} />
                  Account Information
                </h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
                  <div style={{ background: "#f0f9ff", padding: 24, borderRadius: 16, border: "2px solid #bae6fd" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <User size={20} color="#0369a1" />
                      <div style={{ fontSize: 13, color: "#0369a1", fontWeight: 600, textTransform: "uppercase" }}>Username</div>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#0c4a6e" }}>{userData.username}</div>
                  </div>

                  <div style={{ background: "#f0f9ff", padding: 24, borderRadius: 16, border: "2px solid #bae6fd" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <Mail size={20} color="#0369a1" />
                      <div style={{ fontSize: 13, color: "#0369a1", fontWeight: 600, textTransform: "uppercase" }}>Email</div>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#0c4a6e" }}>{userData.email}</div>
                  </div>

                  <div style={{ background: "#f0f9ff", padding: 24, borderRadius: 16, border: "2px solid #bae6fd" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <Shield size={20} color="#0369a1" />
                      <div style={{ fontSize: 13, color: "#0369a1", fontWeight: 600, textTransform: "uppercase" }}>Account Role</div>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#0c4a6e", textTransform: "capitalize" }}>{userData.role}</div>
                  </div>

                  <div style={{ background: "#f0f9ff", padding: 24, borderRadius: 16, border: "2px solid #bae6fd" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <Calendar size={20} color="#0369a1" />
                      <div style={{ fontSize: 13, color: "#0369a1", fontWeight: 600, textTransform: "uppercase" }}>Member Since</div>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#0c4a6e" }}>
                      {new Date(userData.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'edit' && (
              <div style={{ maxWidth: 500, animation: "slideIn 0.3s ease-out" }}>
                <h2 style={{ fontSize: 24, fontWeight: 800, color: "#1565c0", marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}>
                  <Edit size={28} />
                  Edit Profile
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#455a64", marginBottom: 8 }}>Username</label>
                    <input
                      type="text"
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.target.value)}
                      required
                      style={{ width: "100%", padding: "14px 16px", border: "2px solid #e3f2fd", borderRadius: 12, fontSize: 15, outline: "none", fontWeight: 500 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#455a64", marginBottom: 8 }}>Email</label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      required
                      style={{ width: "100%", padding: "14px 16px", border: "2px solid #e3f2fd", borderRadius: 12, fontSize: 15, outline: "none", fontWeight: 500 }}
                    />
                  </div>
                  {editMessage && (
                    <div style={{ padding: 16, background: "#d1fae5", border: "2px solid #6ee7b7", borderRadius: 12, color: "#065f46", fontWeight: 600, display: "flex", alignItems: "center", gap: 10 }}>
                      <Check size={20} />
                      {editMessage}
                    </div>
                  )}
                  {editError && (
                    <div style={{ padding: 16, background: "#fee2e2", border: "2px solid #fca5a5", borderRadius: 12, color: "#991b1b", fontWeight: 600, display: "flex", alignItems: "center", gap: 10 }}>
                      <X size={20} />
                      {editError}
                    </div>
                  )}
                  <button onClick={handleProfileUpdate} style={{ width: "100%", padding: "16px", background: "linear-gradient(135deg, #42a5f5 0%, #1e88e5 100%)", color: "#fff", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px rgba(66, 165, 245, 0.4)" }}>
                    Update Profile
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'password' && (
              <div style={{ maxWidth: 500, animation: "slideIn 0.3s ease-out" }}>
                <h2 style={{ fontSize: 24, fontWeight: 800, color: "#1565c0", marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}>
                  <Lock size={28} />
                  Change Password
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#455a64", marginBottom: 8 }}>Current Password</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      style={{ width: "100%", padding: "14px 16px", border: "2px solid #e3f2fd", borderRadius: 12, fontSize: 15, outline: "none", fontWeight: 500 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#455a64", marginBottom: 8 }}>New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={8}
                      style={{ width: "100%", padding: "14px 16px", border: "2px solid #e3f2fd", borderRadius: 12, fontSize: 15, outline: "none", fontWeight: 500 }}
                    />
                    <p style={{ fontSize: 12, color: "#78909c", marginTop: 6 }}>Must be at least 8 characters long</p>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#455a64", marginBottom: 8 }}>Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      style={{ width: "100%", padding: "14px 16px", border: "2px solid #e3f2fd", borderRadius: 12, fontSize: 15, outline: "none", fontWeight: 500 }}
                    />
                  </div>
                  {passwordMessage && (
                    <div style={{ padding: 16, background: "#d1fae5", border: "2px solid #6ee7b7", borderRadius: 12, color: "#065f46", fontWeight: 600, display: "flex", alignItems: "center", gap: 10 }}>
                      <Check size={20} />
                      {passwordMessage}
                    </div>
                  )}
                  {passwordError && (
                    <div style={{ padding: 16, background: "#fee2e2", border: "2px solid #fca5a5", borderRadius: 12, color: "#991b1b", fontWeight: 600, display: "flex", alignItems: "center", gap: 10 }}>
                      <X size={20} />
                      {passwordError}
                    </div>
                  )}
                  <button onClick={handlePasswordChange} style={{ width: "100%", padding: "16px", background: "linear-gradient(135deg, #42a5f5 0%, #1e88e5 100%)", color: "#fff", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px rgba(66, 165, 245, 0.4)" }}>
                    Change Password
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
