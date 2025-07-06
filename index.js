require('dotenv').config();
const admin = require('firebase-admin');
const cors = require('cors');
const fetch = require('node-fetch');    
const crypto = require('crypto');
const FormData = require('form-data');  
const dateFormat = require('dateformat');
const config = require('config');
const verifyToken = require('./firebaseAuthencation');
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  })
});
const express = require('express');
const bodyParser = require('body-parser');
const TSR_PARTNER_KEY = process.env.PARTNER_KEY_TSR;

function md5Hash(input) {
  return crypto.createHash('md5').update(input).digest('hex');
}

const db = admin.firestore();
const app = express();
app.use(bodyParser.json());
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
const count = {
  request_id_count: 13
};
function randomString(length = 10) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for(let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
// vnpay api
app.post('/create-payment-url', async (req,res) =>
  {
    const ipAddr = req.headers['x-forwarded-for'] ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            req.connection.socket.remoteAddress;
       
        var tmnCode = config.get('vnp_TmnCode');
        var secretKey = config.get('vnp_HashSecret');
        var vnpUrl = config.get('vnp_Url');
        var returnUrl = config.get('vnp_ReturnUrl');
    
        var date = new Date();
    
        var createDate = dateFormat(date, 'yyyymmddHHmmss');
        var orderId = dateFormat(date, 'HHmmss');
      var amount = req.body.amount;
        var bankCode = req.body.bankCode;
        
        var orderInfo = req.body.orderDescription;
        var orderType = req.body.orderType;
        var locale = req.body.language;
        if(locale === null || locale === ''){
            locale = 'vn';
        }
        var currCode = 'VND';
        var vnp_Params = {};
        vnp_Params['vnp_Version'] = '2.1.0';
        vnp_Params['vnp_Command'] = 'pay';
        vnp_Params['vnp_TmnCode'] = tmnCode;
        vnp_Params['vnp_Locale'] = locale;
        vnp_Params['vnp_CurrCode'] = currCode;
        vnp_Params['vnp_TxnRef'] = orderId;
        vnp_Params['vnp_OrderInfo'] = orderInfo;
        vnp_Params['vnp_OrderType'] = orderType;
        vnp_Params['vnp_Amount'] = amount * 100;
        vnp_Params['vnp_ReturnUrl'] = returnUrl;
        vnp_Params['vnp_IpAddr'] = ipAddr;
        vnp_Params['vnp_CreateDate'] = createDate;
        if(bankCode !== null && bankCode !== ''){
            vnp_Params['vnp_BankCode'] = bankCode;
        }
        vnp_Params = sortObject(vnp_Params);
        var querystring = require('qs');
        var signData = querystring.stringify(vnp_Params, { encode: false });
        var crypto = require("crypto");     
        var hmac = crypto.createHmac("sha512", secretKey);
        var signed = hmac.update(new Buffer(signData, 'utf-8')).digest("hex"); 
        vnp_Params['vnp_SecureHash'] = signed;
        vnpUrl += '?' + querystring.stringify(vnp_Params, { encode: false });
        res.redirect(vnpUrl)
    });
    
  });
app.get('/charge/callback',async (req,res) => {
  try
  {
 const { status, message, request_id, declared_value, value, amount, code, serial, telco, trans_id, callback_sign } = req.query;
  const docRef = db.collection('lich-su-nap-the').doc(request_id.toString());
  const docSnap = await docRef.get();

  if(docSnap.exists)
  {
    const data = docSnap.data();
    const seri = data.serial;
    const maThe = data.id_the;
    const docUser = db.collection('users').doc(data.uid.toString());
    const userSnap = await docUser.get();
    if(callback_sign == md5Hash(TSR_PARTNER_KEY + maThe + seri))
    {
      if(status == 1 && maThe == code && seri == serial)
      {
        await db.collection('lich-su-nap-the')
        .doc(request_id.toString())
        .update({status: "Thành công"});
        res.status(1).send(message);
        const dataUser =  userSnap.data();
        const coinHienTai = dataUser.coin;
        await db.collection('users')
        .doc(data.uid.toString())
        .update({coin: parseInt(coinHienTai) + parseInt(declared_value)});
      }
      if(status == 2)
      {
        await db.collection('lich-su-nap-the')
        .doc(request_id.toString())
        .update({status: "Thẻ sai mệnh giá"});
        
      }
      if(status == 3 && maThe == code && seri == serial)
      {
        await db.collection('lich-su-nap-the')
        .doc(request_id.toString())
        .update({status: "Thẻ lỗi"});
      }
      if(status == 4)
      {
        await db.collection('lich-su-nap-the')
        .doc(request_id.toString())
        .update({status: "Bảo trì"});
        
      }
       res.status(parseInt(status)).send(message);
    }
  }
  else
  {
    res.status(500).send("error: "+"Lỗi từ bên phía server của tớ! Vui lòng liên hệ với quản trị viên IOEAuto (giauydev) kèm theo mã đơn hàng: "+request_id +" để được hỗ trợ!");
  }
  }
  catch(error)
  {
    res.status(500).send(error.message);
  }
});
// trả về lịch sử nạp thẻ
app.get('/lich-su-nap-the',verifyToken, async (req,res) =>
  {
    try
    {
    const uid = req.uid;
    const snap = await db.collection('lich-su-nap-the')
      .where('uid','==',uid.toString())
      .orderBy('thoi_gian','desc')
      .get();
    if (snap.empty) {
  return res.status(404).send("Không có giao dịch nào.");
}
    const ketQua = [];
    snap.forEach(doc => 
      {
        const data = doc.data();
        ketQua.push(
          {
            "Mã đơn hàng: ": doc.id.toString(),
            "Mã thẻ: ": data.ma_the.toString(),
            "Serial: ": data.serial.toString(),
            "Nhà mạng: ": data.telco.toString(),
            "Trạng thái: ": data.status.toString(),
            "Thời gian: ": data.thoi_gian.toDate().toLocaleString('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh'
})
            
          }
        );
        
      });
    res.status(200).json(ketQua);
    }
    catch(error)
    {
      res.status(500).json({message: "Có lỗi xảy ra!"});
      console.log(error.toString());
    }
  });
app.get('/gui-the',verifyToken,async (req, res) => {
  const nha_mang = req.query.nha_mang;
  const ma_the = req.query.ma_the;
  const serial = req.query.serial;
  const amount = req.query.amount;
  const uid = req.uid;
  const request_id = randomString();
  const partner_id = "21921979864";
  const sign = md5Hash(TSR_PARTNER_KEY + ma_the + serial);
const myHeaders = {
  "Content-Type": "application/json"
};

  const formdata = new FormData();
  formdata.append("telco", nha_mang);
  formdata.append("code", ma_the);
  formdata.append("serial", serial);
  formdata.append("amount", amount);
  formdata.append("request_id", request_id);
  formdata.append("partner_id", partner_id);
  formdata.append("sign", sign);
  formdata.append("command", "charging");

  const requestOptions = {
    method: 'POST',
    body: formdata,
    redirect: 'follow'
  };

try {
  const response = await fetch("http://thesieure.com/chargingws/v2", requestOptions);
  const result = await response.text();
  const data = JSON.parse(result);
  res.send(result);
 await db.collection('lich-su-nap-the')
  .doc(request_id.toString())
  .set({
    uid: req.uid,
    telco: nha_mang,
    serial,
    ma_the: ma_the.slice(-4).padStart(ma_the.length, '*'),
    id_the: ma_the,
    amount,
    status: data.status === 1 ? 'thanh_cong' : (data.status === 99 ? 'dang_xu_ly' : 'that_bai'),
    thoi_gian: admin.firestore.FieldValue.serverTimestamp()
  });
  
} catch (error) {
  console.error('Lỗi khi gửi yêu cầu đến thesieure:', error);
  res.status(500).send('Đã có lỗi xảy ra: ' + error.message);
}
});

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
