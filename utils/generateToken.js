import jwt from 'jsonwebtoken';

const generateToken = (userId, rememberMe = false) => {
  const expiresIn = rememberMe ? '30d' : '1d';

  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: expiresIn,
  });
};

export default generateToken;