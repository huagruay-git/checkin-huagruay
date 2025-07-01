// --- ค่าที่ต้องตั้งค่า ---
const LIFF_ID = "2007675060-Yk4w1JR1"; // <--- แก้ไขเป็น LIFF ID ของคุณ
const GAS_URL ="https://script.google.com/macros/s/AKfycbypHqXYbsJ1cDIFgb81N_xGY60O2KjdNDUmKdfMfYYi-XdeEubOutNLqy7KKXDgRty1SQ/exec"; // <--- แก้ไขเป็น URL ที่คัดลอกมา (URL เดียวกันทั้ง GET และ POST)

// --- ตัวแปร Global ---
let userProfile = {};
let base64Image = null;
let currentBranches = []; // เก็บข้อมูลสาขาที่ดึงมาจาก GAS
let userCurrentLocation = null; // เก็บพิกัดผู้ใช้
let selectedBranchLat = null;
let selectedBranchLng = null;
let selectedBranchRadius = null;

// --- DOM Elements ---
const successMessageDiv = document.getElementById("success-message"); 
const successModal = document.getElementById("successModal"); 
const successStatusSpan = document.getElementById("successStatus"); 
const countdownSpan = document.getElementById("countdown"); 
const loadingOverlay = document.getElementById("loading-overlay");
const appContentDiv = document.getElementById("app-content");
const displayNameSpan = document.getElementById("displayName");
const branchSelect = document.getElementById("branchSelect");
const userLocationDisplay = document.getElementById("userLocationDisplay");
const rangeWarning = document.getElementById("rangeWarning");
const photoInput = document.getElementById("photoInput");
const photoArea = document.getElementById("photoArea");
const previewImg = document.getElementById("preview");
const capturePhotoBtn = document.getElementById("capturePhotoBtn");
const clearPhotoBtn = document.getElementById("clearPhotoBtn");
const checkinBtn = document.getElementById("checkinBtn");
const checkoutBtn = document.getElementById("checkoutBtn");

// --- Functions ---

// 1. ฟังก์ชันเริ่มต้นทั้งหมดเมื่อ LIFF โหลด
document.addEventListener('DOMContentLoaded', async () => {
    showLoading(true, "กำลังเริ่มต้น LIFF...");
    await initializeLiff();
    await fetchBranches();
    await getUserLocation();
    setupEventListeners();
    updateUI();
});



// 2. เริ่มต้นการทำงานของ LIFF
async function initializeLiff() {
  try {
    await liff.init({ liffId: LIFF_ID });
    if (!liff.isLoggedIn()) {
      liff.login();
    } else {
      userProfile = await liff.getProfile();
      displayNameSpan.textContent = userProfile.displayName;
    }
  } catch (error) {
    alert("LIFF initialization failed: " + error.message);
    console.error("LIFF Init Error:", error);
    showLoading(false); // ซ่อน loading แม้มี error
  }
}

// 3. ดึงข้อมูลสาขาจาก Google Apps Script (doGet)
async function fetchBranches() {
  showLoading(true, "กำลังดึงข้อมูลสาขา...");
  try {
    const response = await fetch(GAS_URL, { method: "GET" });
    // ตรวจสอบ response ว่าเป็น JSON และไม่ได้มาจาก error page ของ GAS
    const text = await response.text();
    const data = JSON.parse(text);

    if (data.status === "success") {
      currentBranches = data.branches;
      populateBranchDropdown();
    } else {
      alert("ไม่สามารถดึงข้อมูลสาขาได้: " + data.message);
      console.error("Fetch Branches Error:", data.message);
    }
  } catch (error) {
    alert(
      "เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์ (ดึงสาขา): " + error.message
    );
    console.error("Fetch Branches Network Error:", error);
  } finally {
    showLoading(false);
  }
}

// 4. แสดงสาขาใน Dropdown
function populateBranchDropdown() {
  branchSelect.innerHTML = '<option value="">-- เลือกสาขา --</option>'; // เพิ่มตัวเลือกเริ่มต้น
  currentBranches.forEach((branch) => {
    const option = document.createElement("option");
    option.value = branch.BranchName;
    option.textContent = branch.BranchName;
    branchSelect.appendChild(option);
  });
}

// 5. ดึงพิกัดผู้ใช้
async function getUserLocation() {
  showLoading(true, "กำลังค้นหาพิกัดของคุณ...");
  return new Promise((resolve) => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          userCurrentLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          userLocationDisplay.textContent = `พิกัดของคุณ: ${userCurrentLocation.latitude.toFixed(
            4
          )}, ${userCurrentLocation.longitude.toFixed(4)}`;
          checkAndToggleButtons(); // ตรวจสอบสถานะปุ่มหลังจากได้พิกัด
          showLoading(false);
          resolve();
        },
        (error) => {
          userLocationDisplay.textContent = `พิกัดของคุณ: ไม่สามารถเข้าถึงได้ (โปรดอนุญาตการเข้าถึงตำแหน่ง)`;
          console.error("Geolocation Error:", error);
          alert(
            "ไม่สามารถเข้าถึงพิกัด GPS ได้ โปรดตรวจสอบการอนุญาตตำแหน่งในมือถือของคุณ"
          );
          showLoading(false);
          resolve(); // ยังคง Resolve เพื่อให้โปรแกรมทำงานต่อแม้ไม่มีพิกัด
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      userLocationDisplay.textContent = `พิกัดของคุณ: อุปกรณ์ไม่รองรับ Geolocation`;
      alert("อุปกรณ์ของคุณไม่รองรับการระบุตำแหน่ง");
      showLoading(false);
      resolve();
    }
  });
}

// 6. ตั้งค่า Event Listeners
function setupEventListeners() {
  branchSelect.addEventListener("change", checkAndToggleButtons);
  capturePhotoBtn.addEventListener("click", () => photoInput.click()); // เมื่อคลิกปุ่ม "ถ่ายรูป" ให้คลิก input type="file" จริงๆ
  clearPhotoBtn.addEventListener("click", clearPhoto);
  photoInput.addEventListener("change", handlePhotoSelect);
  checkinBtn.addEventListener("click", () => sendData("Check-in"));
  checkoutBtn.addEventListener("click", () => sendData("Check-out"));
}

// 7. จัดการเมื่อผู้ใช้เลือกรูป
function handlePhotoSelect(event) {
  const file = event.target.files[0];
  if (!file) {
    clearPhoto(); // ถ้าไม่มีไฟล์ ก็เคลียร์รูป
    return;
  }

  // ตรวจสอบขนาดไฟล์ (เช่น ไม่เกิน 5MB)
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  if (file.size > MAX_FILE_SIZE) {
    alert("ขนาดรูปภาพใหญ่เกินไป (สูงสุด 5MB)");
    clearPhoto();
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    base64Image = e.target.result;
    previewImg.src = base64Image;
    previewImg.style.display = "block";
    capturePhotoBtn.style.display = "none";
    clearPhotoBtn.style.display = "inline-block"; // แสดงปุ่มลบ
    checkAndToggleButtons(); // ตรวจสอบสถานะปุ่มหลังจากถ่ายรูป
  };
  reader.readAsDataURL(file);
}

// 8. ลบรูปที่ถ่ายและเตรียมพร้อมถ่ายใหม่
function clearPhoto() {
  base64Image = null;
  previewImg.src = "#";
  previewImg.style.display = "none";
  photoInput.value = ""; // เคลียร์ไฟล์ที่เลือก
  capturePhotoBtn.style.display = "inline-block";
  clearPhotoBtn.style.display = "none";
  checkAndToggleButtons(); // ตรวจสอบสถานะปุ่มหลังจากลบรูป
}

// 9. ตรวจสอบสถานะและเปิด/ปิดปุ่ม Check-in/out
function checkAndToggleButtons() {
  const selectedBranchName = branchSelect.value;
  const isPhotoTaken = base64Image !== null;
  let isInRange = false;

  if (selectedBranchName && userCurrentLocation) {
    const branchData = currentBranches.find(
      (b) => b.BranchName === selectedBranchName
    );
    if (branchData) {
      selectedBranchLat = parseFloat(branchData.Latitude);
      selectedBranchLng = parseFloat(branchData.Longitude);
      selectedBranchRadius = parseFloat(branchData.RadiusKm);

      const distance = calculateDistance(
        userCurrentLocation.latitude,
        userCurrentLocation.longitude,
        selectedBranchLat,
        selectedBranchLng
      );

      // แสดง/ซ่อนคำเตือน
      if (distance > selectedBranchRadius) {
        rangeWarning.style.display = "block";
        isInRange = false;
      } else {
        rangeWarning.style.display = "none";
        isInRange = true;
      }
    }
  } else {
    rangeWarning.style.display = "none"; // ซ่อนคำเตือนถ้ายังไม่เลือกสาขาหรือไม่มีพิกัด
  }

  // เปิด/ปิดปุ่มตามเงื่อนไข
  const canCheck =
    selectedBranchName && isPhotoTaken && userCurrentLocation && isInRange;
  checkinBtn.disabled = !canCheck;
  checkoutBtn.disabled = !canCheck;
}

// 10. คำนวณระยะทางระหว่างสองจุด (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // รัศมีโลกเป็นกิโลเมตร
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // ระยะทางเป็นกิโลเมตร
  return distance;
}

// 11. ส่งข้อมูลไปยัง Google Apps Script
async function sendData(checkType) {
  // ปิดปุ่มและแสดงสถานะ
  checkinBtn.disabled = true;
  checkoutBtn.disabled = true;
  showLoading(true, `กำลังบันทึก ${checkType} ของคุณ...`);

  const selectedBranchName = branchSelect.value;
  const branchData = currentBranches.find(
    (b) => b.BranchName === selectedBranchName
  );
  const distance = calculateDistance(
    userCurrentLocation.latitude,
    userCurrentLocation.longitude,
    parseFloat(branchData.Latitude),
    parseFloat(branchData.Longitude)
  );
  const isWithinRange = distance <= parseFloat(branchData.RadiusKm);

  const payload = {
    userId: userProfile.userId,
    displayName: userProfile.displayName,
    checkType: checkType,
    photo: base64Image,
    branch: selectedBranchName,
    location: `${userCurrentLocation.latitude}, ${userCurrentLocation.longitude}`,
    isWithinRange: isWithinRange,
  };

  try {
    const response = await fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "text/plain;charset=utf-8" },
    });

    const result = await response.json(); // อ่าน response
    if (result.status === "success") {
      showSuccessModal(checkType); 
    } else {
      alert("เกิดข้อผิดพลาดในการบันทึก: " + result.message);
      console.error("GAS Error:", result.message);
      showLoading(false);
      updateUI(); // คืนค่า UI
    }
  } catch (error) {
    alert(
      "เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์ (บันทึกข้อมูล): " +
        error.message
    );
    console.error("Send Data Network Error:", error);
    showLoading(false);
    updateUI(); // คืนค่า UI
  }
}

// 12. แสดงข้อความสำเร็จ
function showSuccessModal(checkType) {
    showLoading(false); // ซ่อน Loading
    appContentDiv.style.display = "none"; // ซ่อนเนื้อหาหลัก
    successModal.style.display = "flex"; // แสดง Modal (ใช้ flex เพื่อจัดกึ่งกลาง)

    successStatusSpan.textContent = checkType; // แสดง "Check-in" หรือ "Check-out"

    let countdown = 3;
    countdownSpan.textContent = countdown;

    const interval = setInterval(() => {
        countdown--;
        countdownSpan.textContent = countdown;
        if (countdown <= 0) {
            clearInterval(interval); // หยุดนับถอยหลัง
            if (liff.isInClient()) {
                liff.closeWindow(); // ปิดหน้าต่าง LIFF
            } else {
                // สำหรับทดสอบบน Browser ทั่วไป
                alert(`${checkType} สำเร็จ! (หน้านี้จะปิดใน LIFF)`);
                successModal.style.display = "none"; // ซ่อน modal ถ้าไม่ได้อยู่ใน LIFF
                appContentDiv.style.display = "block"; // แสดงเนื้อหาหลักกลับมา
                // รีเซ็ตค่าต่างๆ เพื่อให้สามารถ Check-in/out ใหม่ได้
                clearPhoto();
                branchSelect.value = "";
                checkAndToggleButtons();
            }
        }
    }, 1000); // นับถอยหลังทุก 1 วินาที
}

// 13. จัดการการแสดง/ซ่อน Loading Overlay
function showLoading(show, message = "กำลังโหลด...") {
  if (show) {
    loadingOverlay.style.display = "flex";
    loadingOverlay.querySelector("p").textContent = message;
  } else {
    loadingOverlay.style.display = "none";
  }
}

// 14. อัปเดต UI หลังจากโหลดข้อมูลเสร็จ
function updateUI() {
  appContentDiv.style.display = "block";
  showLoading(false);
  checkAndToggleButtons(); // ตรวจสอบสถานะปุ่มเมื่อ UI พร้อม
}
