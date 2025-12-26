import jwt from 'jsonwebtoken';

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_LIFETIME || '15m',
  });
};

export const generateRefreshToken = (userId, rememberMe = false) => {
  const expiresIn = rememberMe 
    ? (process.env.REFRESH_TOKEN_LIFETIME || '30d') 
    : '1d'; 

  return jwt.sign({ userId }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: expiresIn,
  });
};

export default generateToken;