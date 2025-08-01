require('dotenv').config();
const admin = require('firebase-admin');
const cors = require('cors');
const fetch = require('node-fetch');    
const crypto = require('crypto');
const FormData = require('form-data');  
const dateFormat = require('dateformat');
const config = require('config');
const verifyToken = require('./firebaseAuthencation');
const axios = require("axios");
const { wrapper } = require("axios-cookiejar-support");
const { CookieJar } = require("tough-cookie");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const wasmr = require("./loadWasm.js");
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
// uptime server giữ cho backend-srv ko bị sleep
app.get('/ping', (req,res) =>
  {
    res.status(200).send("pong");
  });
// xóa vnpay api (giauydev chưa đủ tuổi mở go-live api)
// tạo lệnh thanh toán
app.get('/create-payment-id', async (req, res) => {
    let randomId = randomString();
    let docRef = db.collection('lich-su-bank').doc(randomId);
    let docSnap = await docRef.get();

    if (docSnap.exists) {
        // Nếu tồn tại 1 mã đơn hàng thì tạo lại 1 mã khác
        randomId = randomString();
        docRef = db.collection('lich-su-bank').doc(randomId);
        docSnap = await docRef.get();
        // nếu vẫn tiếp tục tồn tại thì yêu cầu người dùng khởi động lại trang
        if (docSnap.exists) {
            return res.status(409).send('Vui lòng khởi động lại trang!');
        }
    }
    return res.status(200).send(randomId);
});
app.get('/getAnswer',verifyToken, async(req,res) =>
  {
    try
    {
      
    const userRef = db.collection('users').doc(req.uid);
    const userSnap = await userRef.get();
    if(!userSnap.exists) 
    {
      return res.status(403).json({result: 'Người dùng không hợp lệ'});
    }
      if(!req.query.questId)
      {
        return res.status(400).json({result: 'Thiếu questId'});
      }
    if(userSnap.data().coin < 100)
    {
      return res.status(403).json({result: 'Số dư không đủ.'});
    }
    const ansRef = db.collection('ioe_question').doc(req.query.questId);
    const ansSnap = await ansRef.get();
    if(!ansSnap.exists)
    {
      return res.status(404).json({result: 'Không tìm thấy câu hỏi.'});
    }
    const result = ansSnap.data().ans;
     await userRef.update({
  coin: admin.firestore.FieldValue.increment(-100)
});
    return res.status(200).json({result: result});
    }
    catch(error)
    {
      return res.status(500).json({error: "Lỗi"+error.message});
    }
  });
app.get('/checkToken',verifyToken, async(req,res) =>
  {
    try
    {
    if(req.uid != null)
    {
       return res.status(200).json({message: "Thực hiện thành công"});
    }
      return  res.status(403).json({message: "Thất bại"});
    }
    catch(error)
    {
     return res.status(500).json({error: "Lỗi: "+error.message});
    }
  });
app.get('/get-finishGame-js',verifyToken,async(req,res) =>
  {
    try
    {
    const userRef = db.collection('users').doc(req.uid);
    const userSnap = await userRef.get();
     if(!userSnap.exists) 
    {
      return res.status(403).json({result: 'Người dùng không hợp lệ'});
    }
      if(!req.query.questIds || !req.query.token || !req.query.examKey)
      {
        return res.status(400).json({result: 'Thiếu thông tin!'});
      }
    let listQuestion = req.query.questIds.split('|');
    if(userSnap.data().coin < listQuestion.length*100)
    {
      return res.status(403).json({result: 'Số dư cần thiết không đủ để thực hiện hành động này!'});
    }
    
    const result = {
      api_key: "gameioe",
      token: req.query.token,
      serviceCode: "IOE",
      examKey: req.query.examKey,
      ans: [],
      IPClient: "",
      deviceId: ""
      
    };
      let validCount = 0;
    for(let i = 0; i< listQuestion.length;i++)
      {
        const ansRef = db.collection('ioe_question').doc(listQuestion[i]);
        const ansSnap = await ansRef.get();
        if(!ansSnap.exists)
        {
          result.ans.push(
            {
              questId: parseInt(listQuestion[i]),
              ans: "Không tìm thấy câu hỏi.",
              Point: 10
            }
          );
          continue;
        }
         result.ans.push(
            {
              questId: parseInt(listQuestion[i]),
              ans: ansSnap.data().ans,
              Point: 10
            }
          );
        validCount++;
        
        
      }
      if(validCount > 0)
      {
      await userRef.update(
        {
            coin: admin.firestore.FieldValue.increment(-100 * validCount)
        });
      }
    return res.status(200).json(result);
    }
    catch(error)
    {
      return res.status(500).json({message: "Lỗi: "+ error.message});
    }
    
  });
app.get('/get-qr-url',verifyToken, async (req,res) =>
  {
    try
    {
      res.status(200).send("https://api.vietqr.io/image/970422-0947240001-8XAevHM.jpg?addInfo=username "+req.username);
    }
    catch(error)
    {
      res.status(400).send(error.message);
    }
  });
  let session_id = "";
  const device_id = process.env.device_id;
  const mb_cookie = process.env.mb_cookie;
  const mb_authorization = process.env.mb_authorization;
  const account_no = process.env.account_no;
  const refNo = process.env.ref_no;
// mbbank api

setInterval(async () => {
  try {
    const lichSuGiaoDich = await checkLsgd();
    const lsgdNhanTien = lichSuGiaoDich;
console.log(lsgdNhanTien.length);
    
    for (let i = 0; i < lsgdNhanTien.length; i++) {
let desc = lsgdNhanTien[i].addDescription.trim();
const emailMatch = desc.match(/username ([A-Za-z0-9.-]+)/);
      if (emailMatch) {
        desc = emailMatch[1];
        console.log(desc);
        const snapshot = await db.collection('lich-su-bank')
          .where('username_nhan_tien', '==', desc)
          .where('ma_giao_dich', '==', '')
          .where('trang_thai', '==', 'Đang chờ xử lý')
          .limit(1)
          .get();

        if (!snapshot.empty) {
          const existingDoc = await db.collection('ft_mb').doc(lsgdNhanTien[i].refNo).get();
          console.log('01');
          console.log(desc);
          if (!existingDoc.exists) {
       
            console.log(desc);
            const userSnap = await db.collection('users')
              .where('username', '==', desc)
              .limit(1)
              .get();

            if (!userSnap.empty) {
              const userDoc = userSnap.docs[0];
              const userData = userDoc.data();
              const currentCoin = userData.coin || 0;

              await db.collection('users').doc(userDoc.id).update({
                coin: currentCoin + parseInt(lsgdNhanTien[i].creditAmount)
              });

              const bankDoc = snapshot.docs[0];
              await db.collection('lich-su-bank').doc(bankDoc.id).update({
                da_nhan: lsgdNhanTien[i].creditAmount,
                ma_giao_dich: lsgdNhanTien[i].refNo,
                trang_thai: "Thành công"
              });

              await db.collection('ft_mb').doc(lsgdNhanTien[i].refNo).set({
                createdAt: Date.now()
              });
              console.log(`[LSGD] Xử lý: ${desc}, refNo: ${lsgdNhanTien[i].refNo}`);
            }
          }
        }
      }
    }
  } catch (error) {
    console.log('Lỗi:', error.message);
  }
}, 60000);
async function checkLsgd() {


  const url = 'https://online.mbbank.com.vn/api/retail-transactionms/transactionms/get-account-transaction-history';

  const headers = {
    "Content-Type": "application/json",
    "Deviceid": device_id,
    "authorization": mb_authorization,
    "refNo": refNo,
    "Cookie": mb_cookie
  };
  const moment = require('moment-timezone');
  const vnTimeBefore = moment().tz('Asia/Ho_Chi_Minh').subtract(3, 'days').format('DD/MM/YYYY');
  const vnTime = moment().tz('Asia/Ho_Chi_Minh').format('DD/MM/YYYY');

  const payload = JSON.stringify({
    "accountNo": account_no,
    "fromDate": vnTimeBefore,
    "toDate": vnTime,
    "sessionId": session_id,
    "refNo": refNo,
    "deviceIdCommon": device_id
  });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: headers,
      body: payload
    });

    const json = await response.json();
    const result = json.transactionHistoryList;
    
    return result;
  } catch (err) {
    console.error("Lỗi khi gọi API:", err);
    return null;
  }
}
app.get('/bank-transaction-history',verifyToken,async(req,res) =>
  {
    try
    {
    const result = [];
    const bankRef = db.collection('lich-su-bank').where('username_nhan_tien','==',req.username).orderBy('time','desc');
    const bankSnapshot = await bankRef.get();
    if(bankSnapshot.size == 0)
    {
      return res.status(200).json({message: 'Không tìm thấy giao dịch nào được thực hiện trên tài khoản này'});
    }
    bankSnapshot.forEach(doc =>
      {
        result.push({
        ma_don_hang: doc.id,
          ma_giao_dich: doc.data().ma_giao_dich,
          da_nhan: doc.data().da_nhan,
          trang_thai: doc.data().trang_thai,
          time: doc.data().time.toDate().toLocaleString('vi-VN',{timeZone: 'Asia/Ho_Chi_Minh'})
        });
      });
    res.status(200).json(result);
    }
    catch(error)
    {
          return res.status(401).json({error: error.message});
    }
  });
app.get('/create-payment-command',verifyToken, async(req,res) =>
{
  try
  {
  const maDonHang = req.query.ma_don_hang;
  const docRef = db.collection('lich-su-bank').doc(maDonHang);
  const docSnap = await docRef.get();
  if(docSnap.exists)
  {
    return res.status(409).json({error: "Mã đơn hàng đã tồn tại"});
  }
  else
  {
    await docRef.set({
        ma_don_hang: maDonHang,
        username_nhan_tien: req.username,
        da_nhan: "",
        ma_giao_dich: "",
        trang_thai: "Đang chờ xử lý",
        time: admin.firestore.FieldValue.serverTimestamp()
    });
  }
  return res.status(200).json({message: "Thành công"});
  }
  catch
  {
      return res.status(501).json({error: "Internal server error"});

  }
});
// kiểm tra và lưu ssid định kỳ
const jar = new CookieJar();
const client = wrapper(axios.create({ jar }));

const USERNAME_CLIENT = process.env.user_mb;
const PASSWORD_CLIENT = process.env.password_mb;

if (!USERNAME_CLIENT || !PASSWORD_CLIENT) {
  console.log('Please fill your username and password');
  process.exit(1);
}

console.log('Username and password are valid.');

let sessionStore = {
  sessionId: null,
  status: 'Pending',
  timestamp: null
};


async function downloadFile(url) {
  const response = await client({
    url,
    method: "GET",
    responseType: "stream",
  });

  let filename = "";
  const disposition = response.headers["content-disposition"];
  if (disposition && disposition.includes("attachment")) {
    const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
    const matches = filenameRegex.exec(disposition);
    if (matches != null && matches[1]) {
      filename = matches[1].replace(/['"]/g, "");
    }
  }
  if (!filename) filename = path.basename(url);

  const filePath = path.resolve(".", filename);
  const writer = fs.createWriteStream(filePath);
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

async function solveCaptcha(base64Image) {
  try {
    const res = await fetch("http://103.72.96.214:8277/api/captcha/mbbank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base64: base64Image })
    });

    const result = await res.json();

    if (result.status === "success" && result.captcha) {
      return result.captcha;
    } else {
      throw new Error("Invalid CAPTCHA API response");
    }
  } catch (err) {
    console.error("Captcha solve failed:", err.message);
    throw err;
  }
}
async function loginAndStoreSession() {
  try {
    if (!fs.existsSync("./main.wasm")) {
      console.log("Downloading main.wasm...");
      await downloadFile("https://online.mbbank.com.vn/assets/wasm/main.wasm");
    }

    const htmlContent = await client.get("https://online.mbbank.com.vn/pl/login");
    const dom = new JSDOM(htmlContent.data);

    const captchaRes = await client.post(
      "https://online.mbbank.com.vn/api/retail-web-internetbankingms/getCaptchaImage",
      {
        refNo: refNo,
        deviceIdCommon: device_id,
        sessionId: ""
      },
      {
        headers: {
          Authorization: "Basic RU1CUkVUQUlMV0VCOlNEMjM0ZGZnMzQlI0BGR0AzNHNmc2RmNDU4NDNm",
          "Content-Type": "application/json"
        }
      }
    );

    const base64Image = captchaRes.data.imageString;
    const captchaSolution = await solveCaptcha(base64Image);

    const request = {
      userId: USERNAME_CLIENT,
      password: crypto.createHash("md5").update(PASSWORD_CLIENT).digest("hex"),
      captcha: captchaSolution,
      ibAuthen2faString: "c722fa8dd6f5179150f472497e022ba0",
      sessionId: null,
      refNo: refNo,
      deviceIdCommon: device_id
    };
   const { default: runWasm } = await import('./loadWasm.js');
const wasmBytes = fs.readFileSync("./main.wasm");

const dataEnc = await runWasm(wasmBytes, request, "0");

const loginRes = await client.post(
  "https://online.mbbank.com.vn/api/retail_web/internetbanking/v2.0/doLogin",
  { dataEnc },
  {
    headers: {
      Authorization: "Basic RU1CUkVUQUlMV0VCOlNEMjM0ZGZnMzQlI0BGR0AzNHNmc2RmNDU4NDNm",
      app: "MB_WEB",
      "Content-Type": "application/json"
    }
  }
);
    const data = loginRes.data;

    if (data.sessionId) {
      sessionStore = {
        sessionId: data.sessionId,
        status: 'Success',
        timestamp: new Date().toISOString()
      };
      console.log("Session ID mới:", sessionStore.sessionId);
      session_id = sessionStore.sessionId;
    } else {
      throw new Error("not found");
    }
  } catch (err) {
    console.error("error:", err.message);
  }
}

(async () => {
  await loginAndStoreSession();

 setInterval(async () => {
  await loginAndStoreSession();
}, 3 * 60 * 1000); 
})();
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
        const dataUser =  userSnap.data();
        const coinHienTai = dataUser.coin;
        await db.collection('users')
        .doc(data.uid.toString())
        .update({coin: parseInt(coinHienTai) + parseInt(amount)});
           res.status(1).send(message);
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
// trả về lịch sử bank
app.get('')
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
    const docUser = db.collection('users').where('username','==',username);
    const userSnapshot = await docUser.get();
    if(!userSnapshot.empty)
    {
      return res.status(409).json({error: 'Vui lòng thử lại với username khác!'});
    }
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
