'use client';

import { signOut } from "next-auth/react";
import { Button } from "./ui/button";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";

const UserAccountnav = () => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div ref={dropdownRef} style={{ position: "relative" }}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: "#0f172a",
                    color: "#fff",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 16,
                    fontWeight: 500,
                }}
            >
                U
            </button>

            {isOpen && (
                <div
                    style={{
                        position: "absolute",
                        top: "calc(100% + 8px)",
                        right: 0,
                        background: "#fff",
                        border: "1px solid #e2e8f0",
                        borderRadius: 8,
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                        minWidth: 180,
                        zIndex: 50,
                    }}
                >
                    <Link
                        href="/profile"
                        onClick={() => setIsOpen(false)}
                        style={{
                            display: "block",
                            padding: "12px 16px",
                            textDecoration: "none",
                            color: "#0f172a",
                            borderBottom: "1px solid #e2e8f0",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                    >
                        My Profile
                    </Link>
                    <Link
                        href="/favorites"
                        onClick={() => setIsOpen(false)}
                        style={{
                            display: "block",
                            padding: "12px 16px",
                            textDecoration: "none",
                            color: "#0f172a",
                            borderBottom: "1px solid #e2e8f0",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                    >
                        Favourite Routes
                    </Link>
                    <Link
                        href="/history"
                        onClick={() => setIsOpen(false)}
                        style={{
                            display: "block",
                            padding: "12px 16px",
                            textDecoration: "none",
                            color: "#0f172a",
                            borderBottom: "1px solid #e2e8f0",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                    >
                        Search History
                    </Link>
                    <Link
                        href="/admin"
                        onClick={() => setIsOpen(false)}
                        style={{
                            display: "block",
                            padding: "12px 16px",
                            textDecoration: "none",
                            color: "#0f172a",
                            borderBottom: "1px solid #e2e8f0",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                    >
                        Admin Panel
                    </Link>
                    <button
                        onClick={() => {
                            setIsOpen(false);
                            signOut({
                                redirect: true,
                                callbackUrl: `${window.location.origin}/sign-in`,
                            });
                        }}
                        style={{
                            width: "100%",
                            padding: "12px 16px",
                            textAlign: "left",
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            color: "#dc2626",
                            fontWeight: 500,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#fef2f2")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                        Sign Out
                    </button>
                </div>
            )}
        </div>
    );
};

export default UserAccountnav;