    "AIzaSyAQL4Sq2WuNWpfiQ-fe1skRX_8v9E_2Am8",

  authDomain:
    "rojak-drivekit.firebaseapp.com",

  projectId:
    "rojak-drivekit",

  storageBucket:
    "rojak-drivekit.firebasestorage.app",

  messagingSenderId:
    "29128061301",

  appId:
    "1:29128061301:web:5ac3230f2671964fba233c",

  measurementId:
    "G-3KX6GKXBDF"

};


const app =
  initializeApp(
    firebaseConfig
  );


const auth =
  getAuth(app);


const db =
  getFirestore(app);


const storage =
  getStorage(app);


export {
  app,
  auth,
  db,
  storage
};