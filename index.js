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

    for (let i = 0; i < lsgdNhanTien.length; i++) {
let desc = lsgdNhanTien[i].addDescription.trim();
const emailMatch = desc.match(/[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);

      if (emailMatch) {
        desc = emailMatch[0];
        const snapshot = await db.collection('lich-su-bank')
          .where('email_nhan_tien', '==', desc)
          .where('ma_giao_dich', '==', '')
          .where('trang_thai', '==', 'Đang chờ xử lý')
          .limit(1)
          .get();

        if (!snapshot.empty) {
          const existingDoc = await db.collection('ft_mb').doc(lsgdNhanTien[i].refNo).get();
          if (!existingDoc.exists) {
       
            
            const userSnap = await db.collection('users')
              .where('email', '==', desc)
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
            }
          }
        }
      }
    }
  } catch (error) {
    console.log('Lỗi:', error.message);
  }
}, 120000);
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
  const vnTimeBefore = moment().tz('Asia/Ho_Chi_Minh').subtract(15, 'days').format('DD/MM/YYYY');
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
    const rawTestResult = `
    {
    "refNo": "0947240001-2025070714510181-54158",
    "result": {
        "ok": true,
        "message": "Success",
        "responseCode": "00"
    },
    "transactionHistoryList": [
        {
            "postingDate": "08/07/2025 00:01:00",
            "transactionDate": "07/07/2025 23:18:45",
            "accountNo": "0947240001",
            "creditAmount": "2000",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CUSTOMER co loc gi ko . TU: LE MINH DUONG",
            "addDescription": "uyda119@gmail.com  ",
            "availableBalance": "22001",
            "beneficiaryAccount": "",
            "refNo": "FT25189364081564",
            "benAccountName": "LE THE GIA UY",
            "bankName": "MB",
            "benAccountNo": "0947240001",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "01/07/2025 23:59:59",
            "transactionDate": "01/07/2025 11:32:55",
            "accountNo": "0947240001",
            "creditAmount": "20000",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CUSTOMER HOANG TRUNG THANH chuyen tien. TU: HOANG TRUNG THANH",
            "addDescription": "HOANG TRUNG THANH chuyen tien ",
            "availableBalance": "20001",
            "beneficiaryAccount": "",
            "refNo": "FT25182229211912",
            "benAccountName": "LE THE GIA UY",
            "bankName": "MB",
            "benAccountNo": "0947240001",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "21/06/2025 23:59:59",
            "transactionDate": "22/06/2025 01:50:11",
            "accountNo": "0947240001",
            "creditAmount": "1",
            "debitAmount": "0",
            "currency": "VND",
            "description": "Tra lai tien gui, so TK: 0947240001-20250621",
            "addDescription": "",
            "availableBalance": "1",
            "beneficiaryAccount": "",
            "refNo": "0947240001-20250621",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "09/06/2025 23:59:59",
            "transactionDate": "09/06/2025 01:00:43",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "50000",
            "currency": "VND",
            "description": "LE THE GIA UY E1EJ6PSN- Ma GD ACSP/ P2541474",
            "addDescription": "E1EJ6PSN- Ma GD ACSP/ P2541474 ",
            "availableBalance": "0",
            "beneficiaryAccount": "",
            "refNo": "FT25160471567667",
            "benAccountName": "TRAN TRIEU DONG",
            "bankName": "BIDV-Ngân hàng TMCP Đầu tư và Phát triển Việt Nam",
            "benAccountNo": "8863953962",
            "dueDate": "",
            "docId": "",
            "transactionType": "BC2B",
            "pos": "",
            "tracingType": "TRACING_BILATERAL"
        },
        {
            "postingDate": "09/06/2025 23:59:59",
            "transactionDate": "09/06/2025 00:56:24",
            "accountNo": "0947240001",
            "creditAmount": "50000",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CUSTOMER FT2506093810026 090625 00 56 23 871 322   Ma giao dich  Trace871322 Tra ce 871322",
            "addDescription": "FT2506093810026 090625 00 56 23 871  322   Ma giao dich  Trace871322 Tra  ce 871322 ",
            "availableBalance": "50000",
            "beneficiaryAccount": "",
            "refNo": "FT25160260201578",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACSM",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "09/06/2025 00:01:00",
            "transactionDate": "08/06/2025 12:16:22",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "100000",
            "currency": "VND",
            "description": "LE THE GIA UY V0EHWNE6- Ma GD ACSP/ H7856428",
            "addDescription": "V0EHWNE6- Ma GD ACSP/ H7856428 ",
            "availableBalance": "0",
            "beneficiaryAccount": "",
            "refNo": "FT25160908082530",
            "benAccountName": "TRAN QUOC VU",
            "bankName": "BIDV-Ngân hàng TMCP Đầu tư và Phát triển Việt Nam",
            "benAccountNo": "8894755827",
            "dueDate": "",
            "docId": "",
            "transactionType": "BC2B",
            "pos": "",
            "tracingType": "TRACING_BILATERAL"
        },
        {
            "postingDate": "09/06/2025 00:01:00",
            "transactionDate": "08/06/2025 06:52:34",
            "accountNo": "0947240001",
            "creditAmount": "100000",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CUSTOMER FT2506084217365. TU: CAO THI TRA MY",
            "addDescription": "FT2506084217365 ",
            "availableBalance": "100000",
            "beneficiaryAccount": "",
            "refNo": "FT25160917346891",
            "benAccountName": "LE THE GIA UY",
            "bankName": "MB",
            "benAccountNo": "0947240001",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "06/06/2025 23:59:59",
            "transactionDate": "06/06/2025 09:44:38",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "81000",
            "currency": "VND",
            "description": "LE THE GIA UY V0EPQKVU- Ma GD ACSP/ I6860340",
            "addDescription": "V0EPQKVU- Ma GD ACSP/ I6860340 ",
            "availableBalance": "0",
            "beneficiaryAccount": "",
            "refNo": "FT25157012187468",
            "benAccountName": "NGUYEN THI KIM MY",
            "bankName": "BIDV-Ngân hàng TMCP Đầu tư và Phát triển Việt Nam",
            "benAccountNo": "8854803661",
            "dueDate": "",
            "docId": "",
            "transactionType": "BC2B",
            "pos": "",
            "tracingType": "TRACING_BILATERAL"
        },
        {
            "postingDate": "06/06/2025 23:59:59",
            "transactionDate": "06/06/2025 09:05:20",
            "accountNo": "0947240001",
            "creditAmount": "81000",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CUSTOMER T0YBHBWR23 CK 060625 09 05 19 39076 5   Ma giao dich  Trace390765 Trace  390765",
            "addDescription": "T0YBHBWR23 CK 060625 09 05 19 39076  5   Ma giao dich  Trace390765 Trace   390765 ",
            "availableBalance": "81000",
            "beneficiaryAccount": "",
            "refNo": "FT25157558701760",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACSM",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "04/06/2025 23:59:59",
            "transactionDate": "04/06/2025 18:08:37",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "300000",
            "currency": "VND",
            "description": "CUSTOMER an 1 minh ngon hon hehe. DEN: HOANG TRUNG THANH",
            "addDescription": "an 1 minh ngon hon hehe ",
            "availableBalance": "0",
            "beneficiaryAccount": "",
            "refNo": "FT25155112146360",
            "benAccountName": "HOANG TRUNG THANH",
            "bankName": "MB",
            "benAccountNo": "0364573100",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "04/06/2025 23:59:59",
            "transactionDate": "04/06/2025 18:00:11",
            "accountNo": "0947240001",
            "creditAmount": "300000",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CUSTOMER done. TU: HOANG TRUNG THANH",
            "addDescription": "done ",
            "availableBalance": "300000",
            "beneficiaryAccount": "",
            "refNo": "FT25155706887678",
            "benAccountName": "LE THE GIA UY",
            "bankName": "MB",
            "benAccountNo": "0947240001",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "02/06/2025 23:59:59",
            "transactionDate": "02/06/2025 20:50:13",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "10000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 T. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 T ",
            "availableBalance": "0",
            "beneficiaryAccount": "",
            "refNo": "FT25153717603092",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "02/06/2025 23:59:59",
            "transactionDate": "02/06/2025 20:35:48",
            "accountNo": "0947240001",
            "creditAmount": "10000",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CUSTOMER phongle122 D5. TU: LE CAO HONG PHONG",
            "addDescription": "phongle122 D5 ",
            "availableBalance": "10000",
            "beneficiaryAccount": "",
            "refNo": "FT25153928200590",
            "benAccountName": "LE THE GIA UY",
            "bankName": "MB",
            "benAccountNo": "0947240001",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "02/06/2025 00:01:00",
            "transactionDate": "01/06/2025 08:14:12",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "66564",
            "currency": "VND",
            "description": "CUSTOMER uyda122 L. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 L ",
            "availableBalance": "0",
            "beneficiaryAccount": "",
            "refNo": "FT25153465106694",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "02/06/2025 00:01:00",
            "transactionDate": "01/06/2025 08:12:20",
            "accountNo": "0947240001",
            "creditAmount": "66564",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CONG TY TNHH TAM DAI PHAT LUCIA QR.LZKS1J.6312.2- Ma GD ACSP/ hS505 296",
            "addDescription": "QR.LZKS1J.6312.2- Ma GD ACSP/ hS505  296 ",
            "availableBalance": "66564",
            "beneficiaryAccount": "",
            "refNo": "FT25153299007189",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "BI2B",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "02/06/2025 00:01:00",
            "transactionDate": "01/06/2025 08:11:41",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "25800",
            "currency": "VND",
            "description": "CUSTOMER uyda122 C. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 C ",
            "availableBalance": "0",
            "beneficiaryAccount": "",
            "refNo": "FT25153670016312",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "02/06/2025 00:01:00",
            "transactionDate": "01/06/2025 08:11:23",
            "accountNo": "0947240001",
            "creditAmount": "25800",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CUSTOMER QR ISENVG 0213 3   Ma giao dich  Tr ace971016 Trace 971016",
            "addDescription": "QR ISENVG 0213 3   Ma giao dich  Tr  ace971016 Trace 971016 ",
            "availableBalance": "25800",
            "beneficiaryAccount": "",
            "refNo": "FT25153650516428",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACSM",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "02/06/2025 00:01:00",
            "transactionDate": "01/06/2025 08:10:57",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "10000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 X. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 X ",
            "availableBalance": "0",
            "beneficiaryAccount": "",
            "refNo": "FT25153536560213",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "02/06/2025 00:01:00",
            "transactionDate": "01/06/2025 08:07:47",
            "accountNo": "0947240001",
            "creditAmount": "10000",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CUSTOMER loc troi cho. TU: LE MINH DUONG",
            "addDescription": "loc troi cho ",
            "availableBalance": "10000",
            "beneficiaryAccount": "",
            "refNo": "FT25153045456467",
            "benAccountName": "LE THE GIA UY",
            "bankName": "MB",
            "benAccountNo": "0947240001",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "30/05/2025 23:59:59",
            "transactionDate": "30/05/2025 08:03:12",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "16000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 T. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 T ",
            "availableBalance": "0",
            "beneficiaryAccount": "",
            "refNo": "FT25150770482024",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "30/05/2025 23:59:59",
            "transactionDate": "30/05/2025 08:01:21",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "69000",
            "currency": "VND",
            "description": "LE THE GIA UY AP-CASHIN-0947240001-O4CI141e5is94- bank2wallet",
            "addDescription": "AP-CASHIN-0947240001-O4CI141e5is94-  bank2wallet ",
            "availableBalance": "16000",
            "beneficiaryAccount": "",
            "refNo": "FT25150855249880",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACVD",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "30/05/2025 23:59:59",
            "transactionDate": "30/05/2025 07:54:45",
            "accountNo": "0947240001",
            "creditAmount": "85000",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CUSTOMER FT2505300195106   Ma giao dich  Tra ce364513 Trace 364513",
            "addDescription": "FT2505300195106   Ma giao dich  Tra  ce364513 Trace 364513 ",
            "availableBalance": "85000",
            "beneficiaryAccount": "",
            "refNo": "FT25150918353852",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACSM",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "29/05/2025 23:59:59",
            "transactionDate": "29/05/2025 10:14:58",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "99846",
            "currency": "VND",
            "description": "LE THE GIA UY E125KDC7- Ma GD ACSP/ LF539326",
            "addDescription": "E125KDC7- Ma GD ACSP/ LF539326 ",
            "availableBalance": "0",
            "beneficiaryAccount": "",
            "refNo": "FT25149327243020",
            "benAccountName": "PHAN CHI TAM",
            "bankName": "BIDV-Ngân hàng TMCP Đầu tư và Phát triển Việt Nam",
            "benAccountNo": "8824242158",
            "dueDate": "",
            "docId": "",
            "transactionType": "BC2B",
            "pos": "",
            "tracingType": "TRACING_BILATERAL"
        },
        {
            "postingDate": "29/05/2025 23:59:59",
            "transactionDate": "29/05/2025 10:11:49",
            "accountNo": "0947240001",
            "creditAmount": "99846",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CONG TY TNHH TAM DAI PHAT LUCIA QR.CK17E7.7948.8- Ma GD ACSP/ vP892 838",
            "addDescription": "QR.CK17E7.7948.8- Ma GD ACSP/ vP892  838 ",
            "availableBalance": "99846",
            "beneficiaryAccount": "",
            "refNo": "FT25149653353035",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "BI2B",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "29/05/2025 23:59:59",
            "transactionDate": "29/05/2025 10:11:12",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "38700",
            "currency": "VND",
            "description": "CUSTOMER uyda122 C. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 C ",
            "availableBalance": "0",
            "beneficiaryAccount": "",
            "refNo": "FT25149095787948",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "29/05/2025 23:59:59",
            "transactionDate": "29/05/2025 10:10:32",
            "accountNo": "0947240001",
            "creditAmount": "38700",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CUSTOMER QR F4QKKV 0213 3   Ma giao dich  Tr ace227703 Trace 227703",
            "addDescription": "QR F4QKKV 0213 3   Ma giao dich  Tr  ace227703 Trace 227703 ",
            "availableBalance": "38700",
            "beneficiaryAccount": "",
            "refNo": "FT25149789100268",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACSM",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "29/05/2025 23:59:59",
            "transactionDate": "29/05/2025 10:09:31",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "15000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 X. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 X ",
            "availableBalance": "0",
            "beneficiaryAccount": "",
            "refNo": "FT25149005390213",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "29/05/2025 23:59:59",
            "transactionDate": "29/05/2025 10:07:23",
            "accountNo": "0947240001",
            "creditAmount": "15000",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CUSTOMER HOANG TRUNG THANH chuyen tien. TU: HOANG TRUNG THANH",
            "addDescription": "HOANG TRUNG THANH chuyen tien ",
            "availableBalance": "15000",
            "beneficiaryAccount": "",
            "refNo": "FT25149623214840",
            "benAccountName": "LE THE GIA UY",
            "bankName": "MB",
            "benAccountNo": "0947240001",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "27/05/2025 23:59:59",
            "transactionDate": "27/05/2025 20:52:20",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "25800",
            "currency": "VND",
            "description": "CUSTOMER uyda122 T. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 T ",
            "availableBalance": "0",
            "beneficiaryAccount": "",
            "refNo": "FT25147790687519",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "27/05/2025 23:59:59",
            "transactionDate": "27/05/2025 20:51:52",
            "accountNo": "0947240001",
            "creditAmount": "25800",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CUSTOMER QR UBFFV9 3404 4   Ma giao dich  Tr ace156154 Trace 156154",
            "addDescription": "QR UBFFV9 3404 4   Ma giao dich  Tr  ace156154 Trace 156154 ",
            "availableBalance": "25800",
            "beneficiaryAccount": "",
            "refNo": "FT25147721079558",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACSM",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "27/05/2025 23:59:59",
            "transactionDate": "27/05/2025 20:51:34",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "25800",
            "currency": "VND",
            "description": "CUSTOMER uyda122 T. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 T ",
            "availableBalance": "0",
            "beneficiaryAccount": "",
            "refNo": "FT25147379117559",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "27/05/2025 23:59:59",
            "transactionDate": "27/05/2025 20:51:00",
            "accountNo": "0947240001",
            "creditAmount": "25800",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CUSTOMER QR YG3K61 8716 6   Ma giao dich  Tr ace154187 Trace 154187",
            "addDescription": "QR YG3K61 8716 6   Ma giao dich  Tr  ace154187 Trace 154187 ",
            "availableBalance": "25800",
            "beneficiaryAccount": "",
            "refNo": "FT25147062206413",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACSM",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "27/05/2025 23:59:59",
            "transactionDate": "27/05/2025 20:50:54",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "10000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 X. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 X ",
            "availableBalance": "0",
            "beneficiaryAccount": "",
            "refNo": "FT25147496103404",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "27/05/2025 23:59:59",
            "transactionDate": "27/05/2025 20:50:23",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "10000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 C. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 C ",
            "availableBalance": "10000",
            "beneficiaryAccount": "",
            "refNo": "FT25147145408716",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "27/05/2025 23:59:59",
            "transactionDate": "27/05/2025 19:41:43",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "50000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 D7. DEN: HOANG TRUNG THANH",
            "addDescription": "uyda122 D7 ",
            "availableBalance": "20000",
            "beneficiaryAccount": "",
            "refNo": "FT25147850010916",
            "benAccountName": "HOANG TRUNG THANH",
            "bankName": "MB",
            "benAccountNo": "0364573100",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "27/05/2025 23:59:59",
            "transactionDate": "27/05/2025 19:39:43",
            "accountNo": "0947240001",
            "creditAmount": "50000",
            "debitAmount": "0",
            "currency": "VND",
            "description": "NGO SY LONG VND70402VN161377751 CK TRANSFER- Ma  GD ACSP/ at240031",
            "addDescription": "VND70402VN161377751 CK TRANSFER- Ma   GD ACSP/ at240031 ",
            "availableBalance": "70000",
            "beneficiaryAccount": "",
            "refNo": "FT25147760772002",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "BI2B",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "27/05/2025 23:59:59",
            "transactionDate": "27/05/2025 18:29:20",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "17436",
            "currency": "VND",
            "description": "CUSTOMER uyda122 C. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 C ",
            "availableBalance": "20000",
            "beneficiaryAccount": "",
            "refNo": "FT25147047868735",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "27/05/2025 23:59:59",
            "transactionDate": "27/05/2025 18:28:47",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "10000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 X. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 X ",
            "availableBalance": "37436",
            "beneficiaryAccount": "",
            "refNo": "FT25147660963717",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "27/05/2025 23:59:59",
            "transactionDate": "27/05/2025 14:01:40",
            "accountNo": "0947240001",
            "creditAmount": "47436",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CUSTOMER QR WHMVJ0 2023 3   Ma giao dich  Tr ace170096 Trace 170096",
            "addDescription": "QR WHMVJ0 2023 3   Ma giao dich  Tr  ace170096 Trace 170096 ",
            "availableBalance": "47436",
            "beneficiaryAccount": "",
            "refNo": "FT25147589899097",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACSM",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "27/05/2025 23:59:59",
            "transactionDate": "27/05/2025 14:00:57",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "18386",
            "currency": "VND",
            "description": "CUSTOMER uyda122 L. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 L ",
            "availableBalance": "0",
            "beneficiaryAccount": "",
            "refNo": "FT25147881262023",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "27/05/2025 23:59:59",
            "transactionDate": "27/05/2025 14:00:23",
            "accountNo": "0947240001",
            "creditAmount": "8386",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CUSTOMER Tang Gift   Ma giao dich  Trace1676 33 Trace 167633",
            "addDescription": "Tang Gift   Ma giao dich  Trace1676  33 Trace 167633 ",
            "availableBalance": "18386",
            "beneficiaryAccount": "",
            "refNo": "FT25147146577010",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACSM",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "27/05/2025 23:59:59",
            "transactionDate": "27/05/2025 13:57:57",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "10246",
            "currency": "VND",
            "description": "CUSTOMER uyda122 X. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 X ",
            "availableBalance": "10000",
            "beneficiaryAccount": "",
            "refNo": "FT25147901029509",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "27/05/2025 23:59:59",
            "transactionDate": "27/05/2025 13:55:58",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "38000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 TT. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 TT ",
            "availableBalance": "20246",
            "beneficiaryAccount": "",
            "refNo": "FT25147676163077",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "27/05/2025 23:59:59",
            "transactionDate": "27/05/2025 13:55:24",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "10000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 TL. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 TL ",
            "availableBalance": "58246",
            "beneficiaryAccount": "",
            "refNo": "FT25147347007202",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "27/05/2025 23:59:59",
            "transactionDate": "27/05/2025 13:55:01",
            "accountNo": "0947240001",
            "creditAmount": "48246",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CUSTOMER QR E2767K 0421 1   Ma giao dich  Tr ace159010 Trace 159010",
            "addDescription": "QR E2767K 0421 1   Ma giao dich  Tr  ace159010 Trace 159010 ",
            "availableBalance": "68246",
            "beneficiaryAccount": "",
            "refNo": "FT25147089102330",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACSM",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "27/05/2025 23:59:59",
            "transactionDate": "27/05/2025 13:54:34",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "18700",
            "currency": "VND",
            "description": "CUSTOMER uyda122 L. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 L ",
            "availableBalance": "20000",
            "beneficiaryAccount": "",
            "refNo": "FT25147752050421",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "27/05/2025 23:59:59",
            "transactionDate": "27/05/2025 13:54:04",
            "accountNo": "0947240001",
            "creditAmount": "38700",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CUSTOMER QR QOZHTB 9064 4   Ma giao dich  Tr ace158195 Trace 158195",
            "addDescription": "QR QOZHTB 9064 4   Ma giao dich  Tr  ace158195 Trace 158195 ",
            "availableBalance": "38700",
            "beneficiaryAccount": "",
            "refNo": "FT25147509801006",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACSM",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "27/05/2025 23:59:59",
            "transactionDate": "27/05/2025 13:53:28",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "15000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 X. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 X ",
            "availableBalance": "0",
            "beneficiaryAccount": "",
            "refNo": "FT25147536149064",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "27/05/2025 23:59:59",
            "transactionDate": "27/05/2025 13:53:05",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "10800",
            "currency": "VND",
            "description": "CUSTOMER uyda122 X. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 X ",
            "availableBalance": "15000",
            "beneficiaryAccount": "",
            "refNo": "FT25147463208997",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "27/05/2025 23:59:59",
            "transactionDate": "27/05/2025 13:52:35",
            "accountNo": "0947240001",
            "creditAmount": "25800",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CUSTOMER QR XTDYBY 0007 7   Ma giao dich  Tr ace154917 Trace 154917",
            "addDescription": "QR XTDYBY 0007 7   Ma giao dich  Tr  ace154917 Trace 154917 ",
            "availableBalance": "25800",
            "beneficiaryAccount": "",
            "refNo": "FT25147896145357",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACSM",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "27/05/2025 23:59:59",
            "transactionDate": "27/05/2025 13:52:30",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "10000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 C. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 C ",
            "availableBalance": "0",
            "beneficiaryAccount": "",
            "refNo": "FT25147097986330",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "27/05/2025 23:59:59",
            "transactionDate": "27/05/2025 13:52:06",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "10000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 T. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 T ",
            "availableBalance": "10000",
            "beneficiaryAccount": "",
            "refNo": "FT25147462860007",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "27/05/2025 23:59:59",
            "transactionDate": "27/05/2025 13:09:40",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "50000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 D6. DEN: LE CAO HONG PHONG",
            "addDescription": "uyda122 D6 ",
            "availableBalance": "20000",
            "beneficiaryAccount": "",
            "refNo": "FT25147427349407",
            "benAccountName": "LE CAO HONG PHONG",
            "bankName": "MB",
            "benAccountNo": "0342400721",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "27/05/2025 23:59:59",
            "transactionDate": "27/05/2025 13:09:14",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "250000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 L. DEN: HOANG TRUNG THANH",
            "addDescription": "uyda122 L ",
            "availableBalance": "70000",
            "beneficiaryAccount": "",
            "refNo": "FT25147203081204",
            "benAccountName": "HOANG TRUNG THANH",
            "bankName": "MB",
            "benAccountNo": "0364573100",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "26/05/2025 23:59:59",
            "transactionDate": "26/05/2025 10:58:26",
            "accountNo": "0947240001",
            "creditAmount": "320000",
            "debitAmount": "0",
            "currency": "VND",
            "description": "DINH THI DIEU MB 0947240001 DINH THI DIEU chuyen  tien- Ma GD ACSP/ 4R058232",
            "addDescription": "MB 0947240001 DINH THI DIEU chuyen   tien- Ma GD ACSP/ 4R058232 ",
            "availableBalance": "320000",
            "beneficiaryAccount": "",
            "refNo": "FT25146046027814",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "BI2B",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "24/05/2025 23:59:59",
            "transactionDate": "24/05/2025 17:51:16",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "20000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 T. DEN: HOANG TRUNG THANH",
            "addDescription": "uyda122 T ",
            "availableBalance": "0",
            "beneficiaryAccount": "",
            "refNo": "FT25144266211080",
            "benAccountName": "HOANG TRUNG THANH",
            "bankName": "MB",
            "benAccountNo": "0364573100",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "24/05/2025 23:59:59",
            "transactionDate": "24/05/2025 09:46:19",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "130000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 D7. DEN: HOANG TRUNG THANH",
            "addDescription": "uyda122 D7 ",
            "availableBalance": "20000",
            "beneficiaryAccount": "",
            "refNo": "FT25144898165003",
            "benAccountName": "HOANG TRUNG THANH",
            "bankName": "MB",
            "benAccountNo": "0364573100",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "24/05/2025 23:59:59",
            "transactionDate": "24/05/2025 09:20:39",
            "accountNo": "0947240001",
            "creditAmount": "150000",
            "debitAmount": "0",
            "currency": "VND",
            "description": "LE QUANG TRUNG CK14097034- Ma GD ACSP/ jR454112",
            "addDescription": "CK14097034- Ma GD ACSP/ jR454112 ",
            "availableBalance": "150000",
            "beneficiaryAccount": "",
            "refNo": "FT25144334406646",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "BI2B",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "23/05/2025 23:59:59",
            "transactionDate": "23/05/2025 07:01:58",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "50000",
            "currency": "VND",
            "description": "LE THE GIA UY Z87EM7YU- Ma GD ACSP/ E2812213",
            "addDescription": "Z87EM7YU- Ma GD ACSP/ E2812213 ",
            "availableBalance": "0",
            "beneficiaryAccount": "",
            "refNo": "FT25143523489373",
            "benAccountName": "VO XUAN PHUNG",
            "bankName": "BIDV-Ngân hàng TMCP Đầu tư và Phát triển Việt Nam",
            "benAccountNo": "8834473052",
            "dueDate": "",
            "docId": "",
            "transactionType": "BC2B",
            "pos": "",
            "tracingType": "TRACING_BILATERAL"
        },
        {
            "postingDate": "23/05/2025 23:59:59",
            "transactionDate": "23/05/2025 06:22:39",
            "accountNo": "0947240001",
            "creditAmount": "50000",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CUSTOMER FT2505235413884. TU: TRAN QUANG VINH",
            "addDescription": "FT2505235413884 ",
            "availableBalance": "50000",
            "beneficiaryAccount": "",
            "refNo": "FT25143850933758",
            "benAccountName": "LE THE GIA UY",
            "bankName": "MB",
            "benAccountNo": "0947240001",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "22/05/2025 23:59:59",
            "transactionDate": "22/05/2025 13:59:59",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "15000",
            "currency": "VND",
            "description": "CUSTOMER CK WAT7IVGF - Ma giao dich/ Trace 4 19502",
            "addDescription": "CK WAT7IVGF - Ma giao dich/ Trace 4  19502 ",
            "availableBalance": "0",
            "beneficiaryAccount": "",
            "refNo": "FT25142071538636",
            "benAccountName": "DUONG THE GIANG",
            "bankName": "TCB-Ngân hàng TMCP Kỹ thương Việt Nam",
            "benAccountNo": "19073861407010",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACSM",
            "pos": "",
            "tracingType": "ACSM"
        },
        {
            "postingDate": "22/05/2025 23:59:59",
            "transactionDate": "22/05/2025 13:58:10",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "60000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 TL. DEN: HOANG TRUNG THANH",
            "addDescription": "uyda122 TL ",
            "availableBalance": "15000",
            "beneficiaryAccount": "",
            "refNo": "FT25142980215149",
            "benAccountName": "HOANG TRUNG THANH",
            "bankName": "MB",
            "benAccountNo": "0364573100",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "22/05/2025 23:59:59",
            "transactionDate": "22/05/2025 13:55:32",
            "accountNo": "0947240001",
            "creditAmount": "75000",
            "debitAmount": "0",
            "currency": "VND",
            "description": "NGUYEN KIM CHI MBVCB.9586840716.871130.FT250522387 6295.CT tu 1056474275 NGUYEN KIM CH I toi 0947240001 LE THE GIA UY tai  MB- Ma GD ACSP/ uk871130",
            "addDescription": "MBVCB.9586840716.871130.FT250522387  6295.CT tu 1056474275 NGUYEN KIM CH  I toi 0947240001 LE THE GIA UY tai   MB- Ma GD ACSP/ uk871130 ",
            "availableBalance": "75000",
            "beneficiaryAccount": "",
            "refNo": "FT25142035618256",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "BI2B",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "22/05/2025 23:59:59",
            "transactionDate": "22/05/2025 10:32:56",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "18000",
            "currency": "VND",
            "description": "CUSTOMER CK WATPZU2Q - Ma giao dich/ Trace 4 44827",
            "addDescription": "CK WATPZU2Q - Ma giao dich/ Trace 4  44827 ",
            "availableBalance": "0",
            "beneficiaryAccount": "",
            "refNo": "FT25142391757294",
            "benAccountName": "NGUYEN THI HANH",
            "bankName": "ACB Ngan hang TMCP A Chau",
            "benAccountNo": "44498377",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACSM",
            "pos": "",
            "tracingType": "ACSM"
        },
        {
            "postingDate": "22/05/2025 23:59:59",
            "transactionDate": "22/05/2025 10:17:19",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "10000",
            "currency": "VND",
            "description": "LE THE GIA UY CK WATIH1BX- Ma GD ACSP/ CA133550",
            "addDescription": "CK WATIH1BX- Ma GD ACSP/ CA133550 ",
            "availableBalance": "18000",
            "beneficiaryAccount": "",
            "refNo": "FT25142284933122",
            "benAccountName": "PHAM MINH PHUONG",
            "bankName": "VCB - Ngan hang TMCP Ngoai Thuong Viet Nam",
            "benAccountNo": "1048906376",
            "dueDate": "",
            "docId": "",
            "transactionType": "BC2B",
            "pos": "",
            "tracingType": "TRACING_BILATERAL"
        },
        {
            "postingDate": "21/05/2025 23:59:59",
            "transactionDate": "21/05/2025 13:34:11",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "2000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 D6. DEN: TRAN NGUYEN BA HUY",
            "addDescription": "uyda122 D6 ",
            "availableBalance": "28000",
            "beneficiaryAccount": "",
            "refNo": "FT25141201027459",
            "benAccountName": "TRAN NGUYEN BA HUY",
            "bankName": "MB",
            "benAccountNo": "0886086719",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "21/05/2025 23:59:59",
            "transactionDate": "21/05/2025 12:59:49",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "10000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 T. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 T ",
            "availableBalance": "30000",
            "beneficiaryAccount": "",
            "refNo": "FT25141059170073",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "21/05/2025 23:59:59",
            "transactionDate": "21/05/2025 11:13:59",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "10000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 T. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 T ",
            "availableBalance": "40000",
            "beneficiaryAccount": "",
            "refNo": "FT25141709341753",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "21/05/2025 23:59:59",
            "transactionDate": "21/05/2025 11:13:33",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "219000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 D7. DEN: HOANG TRUNG THANH",
            "addDescription": "uyda122 D7 ",
            "availableBalance": "50000",
            "beneficiaryAccount": "",
            "refNo": "FT25141826360790",
            "benAccountName": "HOANG TRUNG THANH",
            "bankName": "MB",
            "benAccountNo": "0364573100",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "21/05/2025 23:59:59",
            "transactionDate": "21/05/2025 11:12:26",
            "accountNo": "0947240001",
            "creditAmount": "229000",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CUSTOMER FT2505217335011   Ma giao dich  Tra ce313958 Trace 313958",
            "addDescription": "FT2505217335011   Ma giao dich  Tra  ce313958 Trace 313958 ",
            "availableBalance": "269000",
            "beneficiaryAccount": "",
            "refNo": "FT25141719029865",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACSM",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "21/05/2025 23:59:59",
            "transactionDate": "21/05/2025 10:51:04",
            "accountNo": "0947240001",
            "creditAmount": "25800",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CUSTOMER QR KP639F 7042 2   Ma giao dich  Tr ace981828 Trace 981828",
            "addDescription": "QR KP639F 7042 2   Ma giao dich  Tr  ace981828 Trace 981828 ",
            "availableBalance": "40000",
            "beneficiaryAccount": "",
            "refNo": "FT25141019280124",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACSM",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "21/05/2025 23:59:59",
            "transactionDate": "21/05/2025 10:51:01",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "25800",
            "currency": "VND",
            "description": "CUSTOMER uyda122 C. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 C ",
            "availableBalance": "14200",
            "beneficiaryAccount": "",
            "refNo": "FT25141102047051",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "21/05/2025 23:59:59",
            "transactionDate": "21/05/2025 10:50:32",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "10000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 X. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 X ",
            "availableBalance": "40000",
            "beneficiaryAccount": "",
            "refNo": "FT25141889887042",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "21/05/2025 23:59:59",
            "transactionDate": "21/05/2025 10:49:24",
            "accountNo": "0947240001",
            "creditAmount": "10000",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CUSTOMER Thanhkonghien D6. TU: HOANG TRUNG THANH",
            "addDescription": "Thanhkonghien D6 ",
            "availableBalance": "50000",
            "beneficiaryAccount": "",
            "refNo": "FT25141607901791",
            "benAccountName": "LE THE GIA UY",
            "bankName": "MB",
            "benAccountNo": "0947240001",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "21/05/2025 23:59:59",
            "transactionDate": "21/05/2025 10:13:13",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "90000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 D4. DEN: HOANG TRUNG THANH",
            "addDescription": "uyda122 D4 ",
            "availableBalance": "40000",
            "beneficiaryAccount": "",
            "refNo": "FT25141725656587",
            "benAccountName": "HOANG TRUNG THANH",
            "bankName": "MB",
            "benAccountNo": "0364573100",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "21/05/2025 23:59:59",
            "transactionDate": "21/05/2025 10:11:47",
            "accountNo": "0947240001",
            "creditAmount": "90000",
            "debitAmount": "0",
            "currency": "VND",
            "description": "TRAN DUC THANG MBVCB.9573266831.817219.EG 810560.C T tu 1054789959 TRAN DUC THANG toi  0947240001 LE THE GIA UY tai MB- Ma  GD ACSP/ ng817219",
            "addDescription": "MBVCB.9573266831.817219.EG 810560.C  T tu 1054789959 TRAN DUC THANG toi   0947240001 LE THE GIA UY tai MB- Ma   GD ACSP/ ng817219 ",
            "availableBalance": "130000",
            "beneficiaryAccount": "",
            "refNo": "FT25141082017264",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "BI2B",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "20/05/2025 23:59:59",
            "transactionDate": "20/05/2025 16:07:08",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "10000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 T. DEN: LE MINH DUONG",
            "addDescription": "uyda122 T ",
            "availableBalance": "40000",
            "beneficiaryAccount": "",
            "refNo": "FT25140409233147",
            "benAccountName": "LE MINH DUONG",
            "bankName": "MB",
            "benAccountNo": "6400721932009",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "20/05/2025 23:59:59",
            "transactionDate": "20/05/2025 15:35:36",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "13386",
            "currency": "VND",
            "description": "CUSTOMER uyda122 L. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 L ",
            "availableBalance": "50000",
            "beneficiaryAccount": "",
            "refNo": "FT25140085186920",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "20/05/2025 23:59:59",
            "transactionDate": "20/05/2025 12:07:59",
            "accountNo": "0947240001",
            "creditAmount": "8386",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CUSTOMER Tang Gift   Ma giao dich  Trace7560 38 Trace 756038",
            "addDescription": "Tang Gift   Ma giao dich  Trace7560  38 Trace 756038 ",
            "availableBalance": "63386",
            "beneficiaryAccount": "",
            "refNo": "FT25140698071486",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACSM",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "20/05/2025 23:59:59",
            "transactionDate": "20/05/2025 12:07:01",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "15000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 C. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 C ",
            "availableBalance": "55000",
            "beneficiaryAccount": "",
            "refNo": "FT25140957656960",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "20/05/2025 23:59:59",
            "transactionDate": "20/05/2025 12:04:31",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "30000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 T. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 T ",
            "availableBalance": "70000",
            "beneficiaryAccount": "",
            "refNo": "FT25140825877201",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "20/05/2025 23:59:59",
            "transactionDate": "20/05/2025 12:03:51",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "40300",
            "currency": "VND",
            "description": "CUSTOMER uyda122 C. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 C ",
            "availableBalance": "100000",
            "beneficiaryAccount": "",
            "refNo": "FT25140690660841",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "20/05/2025 23:59:59",
            "transactionDate": "20/05/2025 12:03:19",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "17000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 X. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 X ",
            "availableBalance": "140300",
            "beneficiaryAccount": "",
            "refNo": "FT25140087203707",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "20/05/2025 23:59:59",
            "transactionDate": "20/05/2025 10:56:59",
            "accountNo": "0947240001",
            "creditAmount": "56760",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CONG TY TNHH TAM DAI PHAT LUCIA QR.HPVCOD.4075.5- Ma GD ACSP/ xu307 946",
            "addDescription": "QR.HPVCOD.4075.5- Ma GD ACSP/ xu307  946 ",
            "availableBalance": "157300",
            "beneficiaryAccount": "",
            "refNo": "FT25140123529401",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "BI2B",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "20/05/2025 23:59:59",
            "transactionDate": "20/05/2025 10:56:25",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "22000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 L. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 L ",
            "availableBalance": "100540",
            "beneficiaryAccount": "",
            "refNo": "FT25140084974075",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "20/05/2025 23:59:59",
            "transactionDate": "20/05/2025 10:56:05",
            "accountNo": "0947240001",
            "creditAmount": "51600",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CONG TY TNHH TAM DAI PHAT LUCIA QR.W316HJ.0788.8- Ma GD ACSP/ Ol305 500",
            "addDescription": "QR.W316HJ.0788.8- Ma GD ACSP/ Ol305  500 ",
            "availableBalance": "122540",
            "beneficiaryAccount": "",
            "refNo": "FT25140795904236",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "BI2B",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "20/05/2025 23:59:59",
            "transactionDate": "20/05/2025 10:55:21",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "20000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 C. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 C ",
            "availableBalance": "70940",
            "beneficiaryAccount": "",
            "refNo": "FT25140504320788",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "20/05/2025 23:59:59",
            "transactionDate": "20/05/2025 10:54:56",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "12000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 T. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 T ",
            "availableBalance": "90940",
            "beneficiaryAccount": "",
            "refNo": "FT25140947571102",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "20/05/2025 23:59:59",
            "transactionDate": "20/05/2025 09:59:07",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "20000",
            "currency": "VND",
            "description": "CUSTOMER CK WATP1ABZ - Ma giao dich/ Trace 1 23882",
            "addDescription": "CK WATP1ABZ - Ma giao dich/ Trace 1  23882 ",
            "availableBalance": "102940",
            "beneficiaryAccount": "",
            "refNo": "FT25140058205750",
            "benAccountName": "NGUYEN THI VAN",
            "bankName": "NCB-Ngân hàng TMCP Quốc Dân",
            "benAccountNo": "196911172323",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACSM",
            "pos": "",
            "tracingType": "ACSM"
        },
        {
            "postingDate": "20/05/2025 23:59:59",
            "transactionDate": "20/05/2025 09:54:40",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "20000",
            "currency": "VND",
            "description": "CUSTOMER gui MLPDKQEPS - Ma giao dich/ Trace  536685",
            "addDescription": "gui MLPDKQEPS - Ma giao dich/ Trace   536685 ",
            "availableBalance": "122940",
            "beneficiaryAccount": "",
            "refNo": "FT25140172727031",
            "benAccountName": "TRAN THI HUONG",
            "bankName": "ACB Ngan hang TMCP A Chau",
            "benAccountNo": "44456857",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACSM",
            "pos": "",
            "tracingType": "ACSM"
        },
        {
            "postingDate": "20/05/2025 23:59:59",
            "transactionDate": "20/05/2025 09:51:13",
            "accountNo": "0947240001",
            "creditAmount": "72240",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CONG TY TNHH TAM DAI PHAT LUCIA QR.2HFN22.8118.8- Ma GD ACSP/ Ol998 602",
            "addDescription": "QR.2HFN22.8118.8- Ma GD ACSP/ Ol998  602 ",
            "availableBalance": "142940",
            "beneficiaryAccount": "",
            "refNo": "FT25140032331109",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "BI2B",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "20/05/2025 23:59:59",
            "transactionDate": "20/05/2025 09:50:24",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "28000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 T. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 T ",
            "availableBalance": "70700",
            "beneficiaryAccount": "",
            "refNo": "FT25140011748118",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "20/05/2025 23:59:59",
            "transactionDate": "20/05/2025 09:50:14",
            "accountNo": "0947240001",
            "creditAmount": "38700",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CUSTOMER QR G87XCT 2204 4   Ma giao dich  Tr ace423992 Trace 423992",
            "addDescription": "QR G87XCT 2204 4   Ma giao dich  Tr  ace423992 Trace 423992 ",
            "availableBalance": "98700",
            "beneficiaryAccount": "",
            "refNo": "FT25140121700030",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACSM",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "20/05/2025 23:59:59",
            "transactionDate": "20/05/2025 09:49:38",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "15000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 C. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 C ",
            "availableBalance": "60000",
            "beneficiaryAccount": "",
            "refNo": "FT25140252412204",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "20/05/2025 23:59:59",
            "transactionDate": "20/05/2025 05:54:01",
            "accountNo": "0947240001",
            "creditAmount": "70000",
            "debitAmount": "0",
            "currency": "VND",
            "description": "DINH THI DIEU MB 0947240001 DINH THI DIEU chuyen  tien- Ma GD ACSP/ QT071025",
            "addDescription": "MB 0947240001 DINH THI DIEU chuyen   tien- Ma GD ACSP/ QT071025 ",
            "availableBalance": "75000",
            "beneficiaryAccount": "",
            "refNo": "FT25140586082353",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "BI2B",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "19/05/2025 23:59:59",
            "transactionDate": "19/05/2025 16:26:09",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "70000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 D2. DEN: LE MINH DUONG",
            "addDescription": "uyda122 D2 ",
            "availableBalance": "5000",
            "beneficiaryAccount": "",
            "refNo": "FT25139070328461",
            "benAccountName": "LE MINH DUONG",
            "bankName": "MB",
            "benAccountNo": "6400721932009",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "19/05/2025 00:01:00",
            "transactionDate": "18/05/2025 11:13:59",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "50000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 C. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 C ",
            "availableBalance": "75000",
            "beneficiaryAccount": "",
            "refNo": "FT25139160045003",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "19/05/2025 00:01:00",
            "transactionDate": "18/05/2025 11:13:33",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "25000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 X. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 X ",
            "availableBalance": "125000",
            "beneficiaryAccount": "",
            "refNo": "FT25139836926815",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "19/05/2025 00:01:00",
            "transactionDate": "18/05/2025 11:09:03",
            "accountNo": "0947240001",
            "creditAmount": "100000",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CUSTOMER FT2505189112764   Ma giao dich  Tra ce487678 Trace 487678",
            "addDescription": "FT2505189112764   Ma giao dich  Tra  ce487678 Trace 487678 ",
            "availableBalance": "150000",
            "beneficiaryAccount": "",
            "refNo": "FT25139425022292",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACSM",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "17/05/2025 23:59:59",
            "transactionDate": "17/05/2025 13:05:30",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "100000",
            "currency": "VND",
            "description": "LE THE GIA UY V09TXQCY- Ma GD ACSP/ 1A719724",
            "addDescription": "V09TXQCY- Ma GD ACSP/ 1A719724 ",
            "availableBalance": "50000",
            "beneficiaryAccount": "",
            "refNo": "FT25137069278743",
            "benAccountName": "NGUYEN CHI DUNG",
            "bankName": "BIDV-Ngân hàng TMCP Đầu tư và Phát triển Việt Nam",
            "benAccountNo": "8875059583",
            "dueDate": "",
            "docId": "",
            "transactionType": "BC2B",
            "pos": "",
            "tracingType": "TRACING_BILATERAL"
        },
        {
            "postingDate": "17/05/2025 23:59:59",
            "transactionDate": "17/05/2025 12:38:28",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "15000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 T. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 T ",
            "availableBalance": "150000",
            "beneficiaryAccount": "",
            "refNo": "FT25137909581344",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "17/05/2025 23:59:59",
            "transactionDate": "17/05/2025 12:36:33",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "35000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 D3. DEN: LE MINH DUONG",
            "addDescription": "uyda122 D3 ",
            "availableBalance": "165000",
            "beneficiaryAccount": "",
            "refNo": "FT25137806670366",
            "benAccountName": "LE MINH DUONG",
            "bankName": "MB",
            "benAccountNo": "6400721932009",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "17/05/2025 23:59:59",
            "transactionDate": "17/05/2025 12:16:05",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "10000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 D4. DEN: HOANG TRUNG THANH",
            "addDescription": "uyda122 D4 ",
            "availableBalance": "200000",
            "beneficiaryAccount": "",
            "refNo": "FT25137656079926",
            "benAccountName": "HOANG TRUNG THANH",
            "bankName": "MB",
            "benAccountNo": "0364573100",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "17/05/2025 23:59:59",
            "transactionDate": "17/05/2025 12:15:46",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "10000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 X. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 X ",
            "availableBalance": "210000",
            "beneficiaryAccount": "",
            "refNo": "FT25137207665518",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "17/05/2025 23:59:59",
            "transactionDate": "17/05/2025 12:15:25",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "10000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 C. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 C ",
            "availableBalance": "220000",
            "beneficiaryAccount": "",
            "refNo": "FT25137310980517",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "17/05/2025 23:59:59",
            "transactionDate": "17/05/2025 12:11:50",
            "accountNo": "0947240001",
            "creditAmount": "130000",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CUSTOMER FT2505174379706   Ma giao dich  Tra ce906641 Trace 906641",
            "addDescription": "FT2505174379706   Ma giao dich  Tra  ce906641 Trace 906641 ",
            "availableBalance": "230000",
            "beneficiaryAccount": "",
            "refNo": "FT25137620332162",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACSM",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "17/05/2025 23:59:59",
            "transactionDate": "17/05/2025 09:59:46",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "9199",
            "currency": "VND",
            "description": "CUSTOMER uyda122 T. DEN: LE MINH DUONG",
            "addDescription": "uyda122 T ",
            "availableBalance": "100000",
            "beneficiaryAccount": "",
            "refNo": "FT25137880778407",
            "benAccountName": "LE MINH DUONG",
            "bankName": "MB",
            "benAccountNo": "6400721932009",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "17/05/2025 23:59:59",
            "transactionDate": "17/05/2025 09:58:59",
            "accountNo": "0947240001",
            "creditAmount": "9199",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CUSTOMER Tang Gift   Ma giao dich  Trace5246 23 Trace 524623",
            "addDescription": "Tang Gift   Ma giao dich  Trace5246  23 Trace 524623 ",
            "availableBalance": "109199",
            "beneficiaryAccount": "",
            "refNo": "FT25137376839203",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACSM",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "17/05/2025 23:59:59",
            "transactionDate": "17/05/2025 09:53:07",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "10000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 T. DEN: LE MINH DUONG",
            "addDescription": "uyda122 T ",
            "availableBalance": "100000",
            "beneficiaryAccount": "",
            "refNo": "FT25137150437342",
            "benAccountName": "LE MINH DUONG",
            "bankName": "MB",
            "benAccountNo": "6400721932009",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "17/05/2025 23:59:59",
            "transactionDate": "17/05/2025 09:50:48",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "80300",
            "currency": "VND",
            "description": "CUSTOMER uyda122 T. DEN: LE MINH DUONG",
            "addDescription": "uyda122 T ",
            "availableBalance": "110000",
            "beneficiaryAccount": "",
            "refNo": "FT25137755008777",
            "benAccountName": "LE MINH DUONG",
            "bankName": "MB",
            "benAccountNo": "6400721932009",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "17/05/2025 23:59:59",
            "transactionDate": "17/05/2025 09:49:17",
            "accountNo": "0947240001",
            "creditAmount": "64500",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CONG TY TNHH TAM DAI PHAT LUCIA QR.KOLTFP.5321.1- Ma GD ACSP/ dC960 199",
            "addDescription": "QR.KOLTFP.5321.1- Ma GD ACSP/ dC960  199 ",
            "availableBalance": "190300",
            "beneficiaryAccount": "",
            "refNo": "FT25137233651147",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "BI2B",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "17/05/2025 23:59:59",
            "transactionDate": "17/05/2025 09:48:45",
            "accountNo": "0947240001",
            "creditAmount": "25800",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CUSTOMER QR 9BURY6 3957 7   Ma giao dich  Tr ace503013 Trace 503013",
            "addDescription": "QR 9BURY6 3957 7   Ma giao dich  Tr  ace503013 Trace 503013 ",
            "availableBalance": "125800",
            "beneficiaryAccount": "",
            "refNo": "FT25137041896783",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACSM",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "16/05/2025 23:59:59",
            "transactionDate": "16/05/2025 18:12:54",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "10000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 T. DEN: HOANG TRUNG THANH",
            "addDescription": "uyda122 T ",
            "availableBalance": "100000",
            "beneficiaryAccount": "",
            "refNo": "FT25136727455630",
            "benAccountName": "HOANG TRUNG THANH",
            "bankName": "MB",
            "benAccountNo": "0364573100",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "16/05/2025 23:59:59",
            "transactionDate": "16/05/2025 18:12:29",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "10388",
            "currency": "VND",
            "description": "CUSTOMER uyda122 T. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 T ",
            "availableBalance": "110000",
            "beneficiaryAccount": "",
            "refNo": "FT25136509370780",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "16/05/2025 23:59:59",
            "transactionDate": "16/05/2025 16:35:42",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "60000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 D3. DEN: HOANG TRUNG THANH",
            "addDescription": "uyda122 D3 ",
            "availableBalance": "120388",
            "beneficiaryAccount": "",
            "refNo": "FT25136260921111",
            "benAccountName": "HOANG TRUNG THANH",
            "bankName": "MB",
            "benAccountNo": "0364573100",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "16/05/2025 23:59:59",
            "transactionDate": "16/05/2025 16:34:32",
            "accountNo": "0947240001",
            "creditAmount": "80000",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CUSTOMER FT2505163018265. TU: DANG NGOC MINH HIEU",
            "addDescription": "FT2505163018265 ",
            "availableBalance": "180388",
            "beneficiaryAccount": "",
            "refNo": "FT25136183463950",
            "benAccountName": "LE THE GIA UY",
            "bankName": "MB",
            "benAccountNo": "0947240001",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "15/05/2025 23:59:59",
            "transactionDate": "15/05/2025 20:57:16",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "8000",
            "currency": "VND",
            "description": "LE THE GIA UY E19Q7CY5- Ma GD ACSP/ 6D146295",
            "addDescription": "E19Q7CY5- Ma GD ACSP/ 6D146295 ",
            "availableBalance": "100388",
            "beneficiaryAccount": "",
            "refNo": "FT25135789009911",
            "benAccountName": "TRAN THI BE BONG",
            "bankName": "BIDV-Ngân hàng TMCP Đầu tư và Phát triển Việt Nam",
            "benAccountNo": "8874571698",
            "dueDate": "",
            "docId": "",
            "transactionType": "BC2B",
            "pos": "",
            "tracingType": "TRACING_BILATERAL"
        },
        {
            "postingDate": "15/05/2025 23:59:59",
            "transactionDate": "15/05/2025 18:29:57",
            "accountNo": "0947240001",
            "creditAmount": "8388",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CUSTOMER Tang Gift   Ma giao dich  Trace8320 48 Trace 832048",
            "addDescription": "Tang Gift   Ma giao dich  Trace8320  48 Trace 832048 ",
            "availableBalance": "108388",
            "beneficiaryAccount": "",
            "refNo": "FT25135635088130",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACSM",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "15/05/2025 23:59:59",
            "transactionDate": "15/05/2025 18:26:50",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "25800",
            "currency": "VND",
            "description": "CUSTOMER uyda122 X. DEN: LE CAO HONG PHONG",
            "addDescription": "uyda122 X ",
            "availableBalance": "100000",
            "beneficiaryAccount": "",
            "refNo": "FT25135484599904",
            "benAccountName": "LE CAO HONG PHONG",
            "bankName": "MB",
            "benAccountNo": "0342400721",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "15/05/2025 23:59:59",
            "transactionDate": "15/05/2025 18:25:38",
            "accountNo": "0947240001",
            "creditAmount": "25800",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CUSTOMER QR MTIHIT 0716 6   Ma giao dich  Tr ace818529 Trace 818529",
            "addDescription": "QR MTIHIT 0716 6   Ma giao dich  Tr  ace818529 Trace 818529 ",
            "availableBalance": "125800",
            "beneficiaryAccount": "",
            "refNo": "FT25135730277947",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACSM",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "15/05/2025 23:59:59",
            "transactionDate": "15/05/2025 18:18:05",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "30000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 X. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 X ",
            "availableBalance": "100000",
            "beneficiaryAccount": "",
            "refNo": "FT25135180705059",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "15/05/2025 23:59:59",
            "transactionDate": "15/05/2025 18:17:42",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "10000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 C. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 C ",
            "availableBalance": "130000",
            "beneficiaryAccount": "",
            "refNo": "FT25135151115005",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "15/05/2025 23:59:59",
            "transactionDate": "15/05/2025 18:16:39",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "10800",
            "currency": "VND",
            "description": "CUSTOMER uyda122 T. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 T ",
            "availableBalance": "140000",
            "beneficiaryAccount": "",
            "refNo": "FT25135100332531",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "15/05/2025 23:59:59",
            "transactionDate": "15/05/2025 18:14:00",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "20000",
            "currency": "VND",
            "description": "LE THE GIA UY V09DVNMN- Ma GD ACSP/ K8808836",
            "addDescription": "V09DVNMN- Ma GD ACSP/ K8808836 ",
            "availableBalance": "150800",
            "beneficiaryAccount": "",
            "refNo": "FT25135070878003",
            "benAccountName": "NGUYEN VAN LOC",
            "bankName": "BIDV-Ngân hàng TMCP Đầu tư và Phát triển Việt Nam",
            "benAccountNo": "8852863254",
            "dueDate": "",
            "docId": "",
            "transactionType": "BC2B",
            "pos": "",
            "tracingType": "TRACING_BILATERAL"
        },
        {
            "postingDate": "15/05/2025 23:59:59",
            "transactionDate": "15/05/2025 18:12:35",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "10000",
            "currency": "VND",
            "description": "LE THE GIA UY Z89DVBKP- Ma GD ACSP/ ZW627533",
            "addDescription": "Z89DVBKP- Ma GD ACSP/ ZW627533 ",
            "availableBalance": "170800",
            "beneficiaryAccount": "",
            "refNo": "FT25135107160539",
            "benAccountName": "TRINH MINH HAI",
            "bankName": "BIDV-Ngân hàng TMCP Đầu tư và Phát triển Việt Nam",
            "benAccountNo": "8863832431",
            "dueDate": "",
            "docId": "",
            "transactionType": "BC2B",
            "pos": "",
            "tracingType": "TRACING_BILATERAL"
        },
        {
            "postingDate": "15/05/2025 23:59:59",
            "transactionDate": "15/05/2025 18:12:03",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "10000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 X. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 X ",
            "availableBalance": "180800",
            "beneficiaryAccount": "",
            "refNo": "FT25135040000109",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "15/05/2025 23:59:59",
            "transactionDate": "15/05/2025 18:11:44",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "10000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 C. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 C ",
            "availableBalance": "190800",
            "beneficiaryAccount": "",
            "refNo": "FT25135636112641",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "15/05/2025 23:59:59",
            "transactionDate": "15/05/2025 18:10:24",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "5000",
            "currency": "VND",
            "description": "LE THE GIA UY E19DVZK9- Ma GD ACSP/ RZ416828",
            "addDescription": "E19DVZK9- Ma GD ACSP/ RZ416828 ",
            "availableBalance": "200800",
            "beneficiaryAccount": "",
            "refNo": "FT25135076203587",
            "benAccountName": "LE VAN TAI",
            "bankName": "BIDV-Ngân hàng TMCP Đầu tư và Phát triển Việt Nam",
            "benAccountNo": "8814528922",
            "dueDate": "",
            "docId": "",
            "transactionType": "BC2B",
            "pos": "",
            "tracingType": "TRACING_BILATERAL"
        },
        {
            "postingDate": "15/05/2025 23:59:59",
            "transactionDate": "15/05/2025 18:09:56",
            "accountNo": "0947240001",
            "creditAmount": "25800",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CUSTOMER QR DVNNLL 6934 4   Ma giao dich  Tr ace770394 Trace 770394",
            "addDescription": "QR DVNNLL 6934 4   Ma giao dich  Tr  ace770394 Trace 770394 ",
            "availableBalance": "205800",
            "beneficiaryAccount": "",
            "refNo": "FT25135038056141",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACSM",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "15/05/2025 23:59:59",
            "transactionDate": "15/05/2025 18:09:21",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "10000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 X. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 X ",
            "availableBalance": "180000",
            "beneficiaryAccount": "",
            "refNo": "FT25135700766934",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "15/05/2025 23:59:59",
            "transactionDate": "15/05/2025 18:07:22",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "400000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 D3. DEN: LE CAO HONG PHONG",
            "addDescription": "uyda122 D3 ",
            "availableBalance": "190000",
            "beneficiaryAccount": "",
            "refNo": "FT25135059530568",
            "benAccountName": "LE CAO HONG PHONG",
            "bankName": "MB",
            "benAccountNo": "0342400721",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "15/05/2025 23:59:59",
            "transactionDate": "15/05/2025 18:06:54",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "10000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 L. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 L ",
            "availableBalance": "590000",
            "beneficiaryAccount": "",
            "refNo": "FT25135007310310",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "15/05/2025 23:59:59",
            "transactionDate": "15/05/2025 18:05:25",
            "accountNo": "0947240001",
            "creditAmount": "600000",
            "debitAmount": "0",
            "currency": "VND",
            "description": "DINH THI DIEU MB 0947240001 DINH THI DIEU chuyen  tien- Ma GD ACSP/ U1017642",
            "addDescription": "MB 0947240001 DINH THI DIEU chuyen   tien- Ma GD ACSP/ U1017642 ",
            "availableBalance": "600000",
            "beneficiaryAccount": "",
            "refNo": "FT25135015589592",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "BI2B",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "14/05/2025 23:59:59",
            "transactionDate": "14/05/2025 11:55:31",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "40000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 D7. DEN: BUI NGOC UYEN",
            "addDescription": "uyda122 D7 ",
            "availableBalance": "0",
            "beneficiaryAccount": "",
            "refNo": "FT25134011048045",
            "benAccountName": "BUI NGOC UYEN",
            "bankName": "MB",
            "benAccountNo": "221120090307",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "13/05/2025 23:59:59",
            "transactionDate": "13/05/2025 09:48:34",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "10000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 X. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 X ",
            "availableBalance": "40000",
            "beneficiaryAccount": "",
            "refNo": "FT25133750148707",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "13/05/2025 23:59:59",
            "transactionDate": "13/05/2025 09:24:19",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "15800",
            "currency": "VND",
            "description": "CUSTOMER uyda122 X. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 X ",
            "availableBalance": "50000",
            "beneficiaryAccount": "",
            "refNo": "FT25133043197920",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "13/05/2025 23:59:59",
            "transactionDate": "13/05/2025 09:23:55",
            "accountNo": "0947240001",
            "creditAmount": "25800",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CUSTOMER QR 4ULWYN 6188 8   Ma giao dich  Tr ace734697 Trace 734697",
            "addDescription": "QR 4ULWYN 6188 8   Ma giao dich  Tr  ace734697 Trace 734697 ",
            "availableBalance": "65800",
            "beneficiaryAccount": "",
            "refNo": "FT25133890674305",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACSM",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "13/05/2025 23:59:59",
            "transactionDate": "13/05/2025 09:23:24",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "10000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 C. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 C ",
            "availableBalance": "40000",
            "beneficiaryAccount": "",
            "refNo": "FT25133127196188",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "12/05/2025 23:59:59",
            "transactionDate": "12/05/2025 21:51:09",
            "accountNo": "0947240001",
            "creditAmount": "25800",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CUSTOMER QR YUNFXX 3687 7   Ma giao dich  Tr ace117358 Trace 117358",
            "addDescription": "QR YUNFXX 3687 7   Ma giao dich  Tr  ace117358 Trace 117358 ",
            "availableBalance": "50000",
            "beneficiaryAccount": "",
            "refNo": "FT25132594995707",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACSM",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "12/05/2025 23:59:59",
            "transactionDate": "12/05/2025 21:50:55",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "25800",
            "currency": "VND",
            "description": "CUSTOMER uyda122 L. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 L ",
            "availableBalance": "24200",
            "beneficiaryAccount": "",
            "refNo": "FT25132311706090",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "12/05/2025 23:59:59",
            "transactionDate": "12/05/2025 21:50:31",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "10000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 T. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 T ",
            "availableBalance": "50000",
            "beneficiaryAccount": "",
            "refNo": "FT25132261773687",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "12/05/2025 23:59:59",
            "transactionDate": "12/05/2025 21:48:41",
            "accountNo": "0947240001",
            "creditAmount": "10000",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CUSTOMER phongle122 D6. TU: LE CAO HONG PHONG",
            "addDescription": "phongle122 D6 ",
            "availableBalance": "60000",
            "beneficiaryAccount": "",
            "refNo": "FT25132557599110",
            "benAccountName": "LE THE GIA UY",
            "bankName": "MB",
            "benAccountNo": "0947240001",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "12/05/2025 23:59:59",
            "transactionDate": "12/05/2025 20:57:05",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "7955",
            "currency": "VND",
            "description": "LE THE GIA UY Z8YFMH5Q- Ma GD ACSP/ IL857110",
            "addDescription": "Z8YFMH5Q- Ma GD ACSP/ IL857110 ",
            "availableBalance": "50000",
            "beneficiaryAccount": "",
            "refNo": "FT25132930376746",
            "benAccountName": "LE ANH NHAT",
            "bankName": "VCB - Ngan hang TMCP Ngoai Thuong Viet Nam",
            "benAccountNo": "0201000664809",
            "dueDate": "",
            "docId": "",
            "transactionType": "BC2B",
            "pos": "",
            "tracingType": "TRACING_BILATERAL"
        },
        {
            "postingDate": "12/05/2025 23:59:59",
            "transactionDate": "12/05/2025 20:53:52",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "2000",
            "currency": "VND",
            "description": "LE THE GIA UY E1YFMPCP- Ma GD ACSP/ X8976086",
            "addDescription": "E1YFMPCP- Ma GD ACSP/ X8976086 ",
            "availableBalance": "57955",
            "beneficiaryAccount": "",
            "refNo": "FT25132608821918",
            "benAccountName": "LE ANH NHAT",
            "bankName": "VCB - Ngan hang TMCP Ngoai Thuong Viet Nam",
            "benAccountNo": "0201000664809",
            "dueDate": "",
            "docId": "",
            "transactionType": "BC2B",
            "pos": "",
            "tracingType": "TRACING_BILATERAL"
        },
        {
            "postingDate": "12/05/2025 23:59:59",
            "transactionDate": "12/05/2025 11:53:11",
            "accountNo": "0947240001",
            "creditAmount": "10555",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CUSTOMER Tang Gift   Ma giao dich  Trace6401 15 Trace 640115",
            "addDescription": "Tang Gift   Ma giao dich  Trace6401  15 Trace 640115 ",
            "availableBalance": "59955",
            "beneficiaryAccount": "",
            "refNo": "FT25132874507177",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACSM",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "12/05/2025 23:59:59",
            "transactionDate": "12/05/2025 08:23:00",
            "accountNo": "0947240001",
            "creditAmount": "5000",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CUSTOMER phongle122 D2. TU: LE CAO HONG PHONG",
            "addDescription": "phongle122 D2 ",
            "availableBalance": "49400",
            "beneficiaryAccount": "",
            "refNo": "FT25132198418948",
            "benAccountName": "LE THE GIA UY",
            "bankName": "MB",
            "benAccountNo": "0947240001",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "12/05/2025 23:59:59",
            "transactionDate": "12/05/2025 08:15:16",
            "accountNo": "0947240001",
            "creditAmount": "25800",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CUSTOMER QR NH2AFQ 6184 4   Ma giao dich  Tr ace108895 Trace 108895",
            "addDescription": "QR NH2AFQ 6184 4   Ma giao dich  Tr  ace108895 Trace 108895 ",
            "availableBalance": "44400",
            "beneficiaryAccount": "",
            "refNo": "FT25132596948896",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACSM",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "12/05/2025 00:01:00",
            "transactionDate": "11/05/2025 11:23:55",
            "accountNo": "0947240001",
            "creditAmount": "2000",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CUSTOMER Trum.top tang ban Giftcode VIP 6CBC 08B5. Nap ngay.. TU: TRAN NGUYEN PHU",
            "addDescription": "Trum.top tang ban Giftcode VIP 6CBC  08B5. Nap ngay. ",
            "availableBalance": "18600",
            "beneficiaryAccount": "",
            "refNo": "FT25132445641740",
            "benAccountName": "LE THE GIA UY",
            "bankName": "MB",
            "benAccountNo": "0947240001",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "10/05/2025 23:59:59",
            "transactionDate": "10/05/2025 09:46:50",
            "accountNo": "0947240001",
            "creditAmount": "15000",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CUSTOMER phongle122 D7. TU: LE MINH DUONG",
            "addDescription": "phongle122 D7 ",
            "availableBalance": "16600",
            "beneficiaryAccount": "",
            "refNo": "FT25130707506237",
            "benAccountName": "LE THE GIA UY",
            "bankName": "MB",
            "benAccountNo": "0947240001",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "09/05/2025 23:59:59",
            "transactionDate": "09/05/2025 17:06:09",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "25000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 D6. DEN: LE CAO HONG PHONG",
            "addDescription": "uyda122 D6 ",
            "availableBalance": "1600",
            "beneficiaryAccount": "",
            "refNo": "FT25129160245206",
            "benAccountName": "LE CAO HONG PHONG",
            "bankName": "MB",
            "benAccountNo": "0342400721",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "09/05/2025 23:59:59",
            "transactionDate": "09/05/2025 17:02:57",
            "accountNo": "0947240001",
            "creditAmount": "25800",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CUSTOMER QR GVXEZN 4842 2   Ma giao dich  Tr ace162059 Trace 162059",
            "addDescription": "QR GVXEZN 4842 2   Ma giao dich  Tr  ace162059 Trace 162059 ",
            "availableBalance": "26600",
            "beneficiaryAccount": "",
            "refNo": "FT25129165997335",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACSM",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "09/05/2025 23:59:59",
            "transactionDate": "09/05/2025 16:58:46",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "10000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 X. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 X ",
            "availableBalance": "800",
            "beneficiaryAccount": "",
            "refNo": "FT25129024417148",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "09/05/2025 23:59:59",
            "transactionDate": "09/05/2025 16:58:08",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "10000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 X. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 X ",
            "availableBalance": "10800",
            "beneficiaryAccount": "",
            "refNo": "FT25129233350540",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "09/05/2025 23:59:59",
            "transactionDate": "09/05/2025 16:57:27",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "10000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 X. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 X ",
            "availableBalance": "20800",
            "beneficiaryAccount": "",
            "refNo": "FT25129003593996",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "09/05/2025 23:59:59",
            "transactionDate": "09/05/2025 16:56:51",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "10000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 L. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 L ",
            "availableBalance": "30800",
            "beneficiaryAccount": "",
            "refNo": "FT25129419051136",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "09/05/2025 23:59:59",
            "transactionDate": "09/05/2025 16:56:16",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "10000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 T. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 T ",
            "availableBalance": "40800",
            "beneficiaryAccount": "",
            "refNo": "FT25129460089299",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "09/05/2025 23:59:59",
            "transactionDate": "09/05/2025 16:56:05",
            "accountNo": "0947240001",
            "creditAmount": "25800",
            "debitAmount": "0",
            "currency": "VND",
            "description": "CUSTOMER QR WBMALH 0974 4   Ma giao dich  Tr ace140144 Trace 140144",
            "addDescription": "QR WBMALH 0974 4   Ma giao dich  Tr  ace140144 Trace 140144 ",
            "availableBalance": "50800",
            "beneficiaryAccount": "",
            "refNo": "FT25129565488929",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACSM",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "09/05/2025 23:59:59",
            "transactionDate": "09/05/2025 16:55:39",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "10000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 X. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 X ",
            "availableBalance": "25000",
            "beneficiaryAccount": "",
            "refNo": "FT25129512400974",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "09/05/2025 23:59:59",
            "transactionDate": "09/05/2025 16:55:00",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "10000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 X. DEN: CONG TY TNHH VIET YACHT RENTAL",
            "addDescription": "uyda122 X ",
            "availableBalance": "35000",
            "beneficiaryAccount": "",
            "refNo": "FT25129206622060",
            "benAccountName": "CONG TY TNHH VIET YACHT RENTAL",
            "bankName": "MB",
            "benAccountNo": "6783838686",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "08/05/2025 23:59:59",
            "transactionDate": "08/05/2025 20:54:29",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "20000",
            "currency": "VND",
            "description": "LE THE GIA UY uyda122 D2- Ma GD ACSP/ RO463909",
            "addDescription": "uyda122 D2- Ma GD ACSP/ RO463909 ",
            "availableBalance": "45000",
            "beneficiaryAccount": "",
            "refNo": "FT25128451253742",
            "benAccountName": "CHAU CHI BAO",
            "bankName": "BIDV-Ngân hàng TMCP Đầu tư và Phát triển Việt Nam",
            "benAccountNo": "8812721642",
            "dueDate": "",
            "docId": "",
            "transactionType": "BC2B",
            "pos": "",
            "tracingType": "TRACING_BILATERAL"
        },
        {
            "postingDate": "08/05/2025 23:59:59",
            "transactionDate": "08/05/2025 06:27:40",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "55000",
            "currency": "VND",
            "description": "LE THE GIA UY AP-CASHIN-0947240001-O4CI1408064xo- bank2wallet",
            "addDescription": "AP-CASHIN-0947240001-O4CI1408064xo-  bank2wallet ",
            "availableBalance": "65000",
            "beneficiaryAccount": "",
            "refNo": "FT25128933601732",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACVD",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "08/05/2025 23:59:59",
            "transactionDate": "08/05/2025 06:20:29",
            "accountNo": "0947240001",
            "creditAmount": "120000",
            "debitAmount": "0",
            "currency": "VND",
            "description": "DINH THI DIEU MB 0947240001 DINH THI DIEU chuyen  tien- Ma GD ACSP/ BR052452",
            "addDescription": "MB 0947240001 DINH THI DIEU chuyen   tien- Ma GD ACSP/ BR052452 ",
            "availableBalance": "120000",
            "beneficiaryAccount": "",
            "refNo": "FT25128559200201",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "BI2B",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "05/05/2025 23:59:59",
            "transactionDate": "05/05/2025 18:03:01",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "60000",
            "currency": "VND",
            "description": "CUSTOMER uyda122 D3. DEN: LE MINH DUONG",
            "addDescription": "uyda122 D3 ",
            "availableBalance": "0",
            "beneficiaryAccount": "",
            "refNo": "FT25125301427241",
            "benAccountName": "LE MINH DUONG",
            "bankName": "MB",
            "benAccountNo": "6400721932009",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "05/05/2025 23:59:59",
            "transactionDate": "05/05/2025 07:43:06",
            "accountNo": "0947240001",
            "creditAmount": "0",
            "debitAmount": "10000",
            "currency": "VND",
            "description": "LE THE GIA UY PHZVNT VIETTEL TOPUP 0978542521 BP0 001l0596m. DEN: CT TNHH DT PT VA CHUYEN GIAO CN VIN",
            "addDescription": "PHZVNT VIETTEL TOPUP 0978542521 BP0  001l0596m 35756300-25050507432020051",
            "availableBalance": "60000",
            "beneficiaryAccount": "",
            "refNo": "FT25125868407714",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "ACIB",
            "pos": "",
            "tracingType": ""
        },
        {
            "postingDate": "05/05/2025 23:59:59",
            "transactionDate": "05/05/2025 06:10:15",
            "accountNo": "0947240001",
            "creditAmount": "70000",
            "debitAmount": "0",
            "currency": "VND",
            "description": "DINH THI DIEU MB 0947240001 DINH THI DIEU chuyen  tien- Ma GD ACSP/ FN082503",
            "addDescription": "MB 0947240001 DINH THI DIEU chuyen   tien- Ma GD ACSP/ FN082503 ",
            "availableBalance": "70000",
            "beneficiaryAccount": "",
            "refNo": "FT25125036961620",
            "benAccountName": "",
            "bankName": "",
            "benAccountNo": "",
            "dueDate": "",
            "docId": "",
            "transactionType": "BI2B",
            "pos": "",
            "tracingType": ""
        }
    ]
}`;
    const testResult = JSON.parse(rawTestResult).transactionHistoryList;
    return testResult;
  } catch (err) {
    console.error("Lỗi khi gọi API:", err);
    return null;
  }
}

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
        email_nhan_tien: req.email,
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
