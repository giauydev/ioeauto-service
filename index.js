require('dotenv').config();
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  })
});
const express = require('express');
const admin = require('firebase-admin');
const bodyParser = require('body-parser');

const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();
app.use(bodyParser.json());

app.post('/register', async (req, res) => {
  const { email, password, username, hoten, fblink } = req.body;

  if (!email || !password || !username || !hoten) {
    return res.status(400).json({ error: 'Thiếu thông tin!' });
  }

  try {
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: username
    });

    await db.collection('users').doc(userRecord.uid).set({
      username,
      email,
      coin: 0,
      is_banned: false,
      ban_reason: "",
      hoten,
      fblink: fblink || "",
      license: "mac_dinh",
      expire: ""
    });

    res.json({ message: 'Tạo tài khoản thành công!', uid: userRecord.uid });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
