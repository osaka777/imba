import { getSessionClient } from "../lib/getSessionClient";

export const verifyUser = async () => {
  try {
    const token = await getSessionClient();
    
    if (!token) {
      return false;
    }

    // Используем Next.js API route вместо прямого обращения к backend
    const response = await fetch('/api/verify', {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    const isVerified = response.ok && response.status === 200;
    
    return isVerified;
  } catch (error) {
    console.error('verifyUser: Error verifying user:', error);
    return false;
  }
};
