# 📳 Phone-to-Phone Vibrate Control System

A simple real-time **vibration control web app** using **Firebase Realtime Database + HTML + CSS + JavaScript**.
Control one phone’s vibration from another phone instantly 🔥

---

## 🚀 Features

* 📱 Phone to Phone Control (Online)
* 📳 ON / OFF Vibration
* 🔁 Blink Vibration Mode (Loop)
* 🎚️ Speed Control Slider
* 🔥 Real-time sync using Firebase
* 🌐 Works as Web App (PWA support)

---

## 🛠️ Technologies Used

* HTML5
* CSS3
* JavaScript (Vanilla JS)
* Firebase Realtime Database

---

## 📂 Project Structure

```
/vibrate-control
│── index.html
│── style.css
│── script.js
│── README.md
```

---

## ⚙️ Setup Instructions

### 1️⃣ Create Firebase Project

1. Go to: https://console.firebase.google.com
2. Click **Add Project**
3. Enter project name (e.g. `vibrate-control`)
4. Continue and create project

---

### 2️⃣ Enable Realtime Database

* Go to **Build → Realtime Database**
* Click **Create Database**
* Select **Test Mode**

---

### 3️⃣ Add Firebase Config

Open `script.js` and replace:

```js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT",
};
```

---

### 4️⃣ Run the Project

* Open `index.html` in browser
  OR
* Deploy using:

#### 🌐 Vercel

https://vercel.com/

#### 🌐 GitHub Pages

https://pages.github.com/

---

## 📱 How to Use

### 🔹 Phone 1 (Controller)

* Open website
* Click buttons (ON / BLINK / OFF)

### 🔹 Phone 2 (Receiver)

* Open same website
* Keep screen ON

👉 Vibration will trigger in real-time

---

## 🎮 Controls

| Button     | Function                  |
| ---------- | ------------------------- |
| 🟢 ON      | Normal vibration          |
| 🟡 BLINK   | Continuous vibration loop |
| 🔴 OFF     | Stop vibration            |
| 🎚️ Slider | Adjust speed              |

---

## ⚠️ Limitations

* Works best on Android (Chrome)
* Background vibration may not work
* iPhone support is limited
* Bluetooth direct phone-to-phone ❌ (not supported in web)

---

## 🔵 Optional Bluetooth Support

Basic Web Bluetooth added (limited support).
For full Bluetooth control:

👉 Use Android App OR ESP32

---

## 💡 Future Improvements

* 🔐 Firebase Authentication
* 📱 Android APK version
* 🎨 Advanced UI (Neon / 3D)
* 📡 Offline Bluetooth system
* 📊 Admin dashboard

---

## 👨‍💻 Author

**Gayantha Lochana**
📞 0751168206
🌐 Portfolio: https://askvenomteam.github.io/

---

## ⭐ Support

If you like this project, give it a ⭐ on GitHub!

---

## 📜 License

This project is free to use for educational purposes.
