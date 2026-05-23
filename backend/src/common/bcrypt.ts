import bcrypt from 'bcryptjs';

// Promise-wrapped bcryptjs functions to mimic bcrypt's async API
export function hash(data: string, saltOrRounds: string | number): Promise<string> {
  return new Promise((resolve, reject) => {
    // bcryptjs accepts a salt string or number of rounds
    // @ts-ignore - types allow both
    bcrypt.hash(data, saltOrRounds, (err: Error | undefined, encrypted: string) => {
      if (err) return reject(err);
      resolve(encrypted);
    });
  });
}

export function compare(data: string, encrypted: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    bcrypt.compare(data, encrypted, (err: Error | undefined, same: boolean) => {
      if (err) return reject(err);
      resolve(same);
    });
  });
}