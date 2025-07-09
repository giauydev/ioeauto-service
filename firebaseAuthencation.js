const db = admin.firestore(); 
async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).send('Thiếu token');
  }

  const idToken = authHeader.split(' ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.uid = decodedToken.uid;
    req.email = decodedToken.email;
     const userSnap = await db
      .collection('users')
      .where('email', '==', decodedToken.email)
      .limit(1)
      .get();
    const userData = userSnap.docs[0].data();
    req.username = userData.username;
    next();
  } catch (error) {
    console.error("Lỗi xác thực:", error);
    return res.status(401).send('Token không hợp lệ');
  }
}

module.exports = verifyToken;
