import { getSession } from "../lib";

export const verifyUserServer = async () => {
  try {
    const token = await getSession();
    
    if (!token) {
      return false;
    }

    // Используем относительный путь для API роута
    const response = await fetch('/api/verify', {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    const isVerified = response.ok && response.status === 200;
    
    if (!isVerified) {
    }
    
    return isVerified;
  } catch (error) {
    console.error('verifyUserServer: Error verifying user:', error);
    return false;
  }
};