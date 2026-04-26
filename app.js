// 파일 시스템(FS) 모듈과 터미널 입출력을 위한 readline 모듈 불러오기
const fs = require("fs");
const readline = require("readline");

// 데이터 저장을 위한 텍스트 파일 경로 상수 정의
const MOVIES_FILE = "movies.txt";
const SCREENINGS_FILE = "screenings.txt";
const RESERVATIONS_FILE = "reservations.txt";

// 공통 명령어 상수 정의 (도움말, 종료, 뒤로가기, 메인으로)
const CMD = {
  HELP: "help",
  QUIT: "quit",
  BACK: "back",
  MAIN: "main",
};

// 흐름 제어를 위한 반환 객체 정의 (단순 문자열 입력과 구분하기 위함)
const CTRL = {
  BACK: { type: "control", command: CMD.BACK },
  MAIN: { type: "control", command: CMD.MAIN },
};

// 터미널 입출력 인터페이스 설정
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

/* =========================
   파일 I/O 유틸리티
========================= */

// 파일이 존재하지 않으면 빈 파일로 생성하는 함수. reservations.txt(예매 내역 정보 파일)에만 해당함.
function ensureFileExists(fileName) {
  if (!fs.existsSync(fileName)) {
    fs.writeFileSync(fileName, "", "utf8");
  }
}

// 텍스트 파일을 읽어 줄 단위로 분리하고, 공백을 제거한 뒤 빈 줄은 제외하여 반환
function readRawLines(fileName) {
  const content = fs.readFileSync(fileName, "utf8");
  if (!content.trim()) return [];
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean); // 빈 문자열 필터링
}

// 배열 형태의 데이터를 개행문자(\n)로 연결하여 파일에 덮어쓰기
function writeLines(fileName, lines) {
  fs.writeFileSync(fileName, lines.join("\n"), "utf8");
}

/* =========================
   CLI 공통 유틸리티
========================= */

// 도움말 출력
function printHelp() {
  console.log("\n[도움말]");
  console.log("help : 도움말 보기");
  console.log("quit : 프로그램 종료");
  console.log("back : 이전 단계로 이동");
  console.log("main : 메인 메뉴로 이동");
}

// 프로그램 안전 종료 (인터페이스 닫기 및 프로세스 종료)
function safeExit() {
  console.log("프로그램을 종료합니다.");
  rl.close();
  process.exit(0);
}

/* =========================
   입력 정규화 및 처리
========================= */

// 사용자의 모든 입력에서 공백 제거
function normalizeInput(input) {
  return input.replace(/\s+/g, "");
}

// 순수하게 질문을 던지고 공백이 제거된 입력을 반환받는 프로미스 래퍼
function askRaw(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(normalizeInput(answer)));
  });
}

// 글로벌 명령어(help, quit, back, main)를 가로채어 처리하는 핵심 입력 함수
async function askInput(question, options = {}) {
  const { allowBack = true, allowMain = true } = options;

  while (true) {
    const input = await askRaw(question);
    const lowered = input.toLowerCase();

    // 빈 입력 방지
    if (!input) {
      console.log(
        "빈 입력은 허용되지 않습니다. back/main/help/quit 또는 올바른 값을 입력하세요.",
      );
      continue;
    }

    if (lowered === CMD.HELP) {
      printHelp();
      continue; // 도움말 출력 후 다시 입력받음
    }

    if (lowered === CMD.QUIT) {
      safeExit(); // 즉시 종료
    }

    if (lowered === CMD.BACK) {
      if (!allowBack) {
        console.log("이미 최상위 단계입니다.");
        continue;
      }
      return CTRL.BACK; // 제어 객체 반환
    }

    if (lowered === CMD.MAIN) {
      if (!allowMain) {
        console.log("이미 메인 메뉴입니다.");
        continue;
      }
      return CTRL.MAIN; // 제어 객체 반환
    }

    // 일반 입력값 반환
    return input;
  }
}

// 반환값이 제어 객체(back, main)인지 확인하는 헬퍼 함수
function isControl(result) {
  return result && typeof result === "object" && result.type === "control";
}

/* =========================
   문법 / 의미 규칙 검증 (Validation)
========================= */

// 영화 제목: 공백으로 시작하지 않으며 최소 1글자 이상
function validateMovieTitleSyntax(title) {
  return /^[^\s].*/.test(title) && title.length >= 1;
}

// 영화 코드: M001, M023 등 대문자 M과 숫자 3자리
function validateMovieCodeSyntax(code) {
  return /^M[0-9]{3}$/.test(code);
}

// 상영 코드: S001 등 대문자 S와 숫자 3자리
function validateScreeningCodeSyntax(code) {
  return /^S[0-9]{3}$/.test(code);
}

// 예약 코드: R001 등 대문자 R과 숫자 3자리
function validateReservationCodeSyntax(code) {
  return /^R[0-9]{3}$/.test(code);
}

// 상영관: 1~9 사이의 한 자리 숫자
function validateTheaterSyntax(theater) {
  return /^[1-9]$/.test(theater);
}

// 날짜 내부 저장 형식: YYYY-MM-DD 정규식 검증
function validateDateSyntax(date) {
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date);
}

// 날짜 입력 문법 (유연한 입력):
// 예: -202-4-1-1-0-8, 2000-03-11-, 20240311 모두 허용 (숫자 8개와 하이픈만 존재)
function validateFlexibleDateSyntax(input) {
  return /^-*(\d-*){8}$/.test(input);
}

// 유연하게 입력된 날짜를 하이픈 제거 후 YYYY-MM-DD 형식으로 정규화
function normalizeDateInput(input) {
  const digits = input.replace(/-/g, "");
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

// 날짜의 실제 의미 검증 (유효한 연, 월, 일인지 달력 기준 확인)
function validateDateSemantic(date) {
  if (!validateDateSyntax(date)) return false;

  const [yearStr, monthStr, dayStr] = date.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  // YYYY는 2000년 이상만 허용
  if (year < 2000) return false;

  // MM은 1~12
  if (month < 1 || month > 12) return false;

  // DD는 해당 연월에 실제 존재하는 날짜여야 함 (윤년 등 자동 계산)
  const lastDay = new Date(year, month, 0).getDate();
  return day >= 1 && day <= lastDay;
}

// 영화 상영 시간이 최대 6시간(360분)을 초과하지 않는지 검증
function validateMaxDuration(time) {
  const range = parseTimeRange(time);
  if (!range) return false;

  const duration = range.end - range.start; // 분 단위
  return duration <= 360; // 6시간 = 360분
}

// 상영 시간: "HH:MM-HH:MM" 또는 "HH:MM - HH:MM" 정규식 검증 (24시간제)
function validateTimeRangeSyntax(time) {
  return /^([0-1][0-9]|2[0-3]):([0-5][0-9])\s*-\s*([0-1][0-9]|2[0-3]):([0-5][0-9])$/.test(
    time,
  );
}

// 상영 시간을 "HH:MM - HH:MM" 포맷으로 통일하여 정규화
function normalizeTimeRange(time) {
  const match = time.match(
    /^([0-1][0-9]|2[0-3]):([0-5][0-9])\s*-\s*([0-1][0-9]|2[0-3]):([0-5][0-9])$/,
  );
  if (!match) return time;

  const start = `${match[1]}:${match[2]}`;
  const end = `${match[3]}:${match[4]}`;
  return `${start} - ${end}`;
}

// "HH:MM" 문자열을 자정 기준 누적 분(minutes)으로 변환
function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// 시간 문자열을 파싱하여 시작 분과 종료 분 객체로 반환
function parseTimeRange(time) {
  if (!validateTimeRangeSyntax(time)) return null;

  const normalized = normalizeTimeRange(time);
  const [startStr, endStr] = normalized.split(" - ");
  const start = timeToMinutes(startStr);
  let end = timeToMinutes(endStr);

  // 23:30 - 02:00 처럼 자정을 넘기는 심야 상영 허용 처리
  if (end <= start) {
    end += 24 * 60;
  }

  return { start, end };
}

// 특정 상영(screening)의 날짜와 시간을 합쳐 절대 시간(분 단위) 범위 반환
function getAbsoluteRange(screening) {
  const baseDate = new Date(screening.date);
  const baseMinutes = baseDate.getTime() / (1000 * 60);

  const range = parseTimeRange(screening.time);
  if (!range) return null;

  return {
    start: baseMinutes + range.start,
    end: baseMinutes + range.end,
  };
}

// 시작 시간이 종료 시간보다 이전인지 논리적 의미 검증
function validateTimeSemantic(time) {
  const range = parseTimeRange(time);
  if (!range) return false;
  return range.start < range.end;
}

// 두 시간대가 서로 겹치는지 확인 (시작<끝, 끝>시작 로직)
function isTimeOverlap(rangeA, rangeB) {
  return rangeA.start < rangeB.end && rangeB.start < rangeA.end;
}

// 좌석 행렬 형태 검증: 1~9로 시작하는 자연수인지 (01 불가)
function validateSeatGridSyntax(rows, cols) {
  // 숫자 형식
  if (!/^[1-9][0-9]*$/.test(String(rows))) return false;
  if (!/^[1-9][0-9]*$/.test(String(cols))) return false;

  const r = Number(rows);
  const c = Number(cols);

  // 절대 좌석 체계 제한
  if (r > 26) return false; // Z까지
  if (c > 99) return false; // 두 자리까지

  return true;
}

// 좌석 행렬 의미 검증: 행 1~26(A~Z), 열 1~99 범위 제한
function validateSeatGridSemantic(rows, cols) {
  return rows > 0 && cols > 0 && rows <= 26 && cols <= 99;
}

// 전화번호 형식 검증: 숫자와 하이픈(-)만 허용 및 길이 검증
function validatePhoneSyntax(phone) {
  // 숫자와 - 만 허용
  if (!/^[0-9-]+$/.test(phone)) return false;

  // - 제거 후 순수 숫자 추출
  const digits = phone.replace(/-/g, "");

  // 숫자 최소 6개 이상
  if (digits.length < 6) return false;

  // 010 시작이면 총 숫자 11개
  if (digits.startsWith("010")) {
    return digits.length === 11;
  }

  // 01X (X != 0) 시작이면 총 숫자 10개 또는 11개
  if (digits.startsWith("01") && digits.length >= 3 && digits[2] !== "0") {
    return digits.length === 10 || digits.length === 11;
  }

  // 그 외는 숫자 6개 이상이면 허용
  return true;
}

// 전화번호 비교를 위해 하이픈을 제거하여 정규화
function normalizePhone(phone) {
  return phone.replace(/-/g, "");
}

// 두 전화번호가 (하이픈 무시하고) 같은지 확인
function samePhone(a, b) {
  return normalizePhone(a) === normalizePhone(b);
}

// 사용자 좌석 입력 파싱 (예: A1 -> {row: 'A', col: 1})
function parseSeatInput(input) {
  // 대문자만 허용
  // 가능: A1, B3, C10
  // 불가: a1, b3, A01, A09
  const match = input.match(/^([A-Z])([1-9][0-9]?)$/);
  if (!match) return null;

  const row = match[1];
  const col = Number(match[2]);

  return { row, col };
}

// reservations.txt 저장용 좌석 형식 파싱 (입력 파싱과 동일한 규칙 적용)
function parseStoredSeat(seatText) {
  const match = seatText.match(/^([A-Z])([1-9][0-9]?)$/);
  if (!match) return null;

  return {
    row: match[1],
    col: Number(match[2]),
  };
}

// 해당 상영관의 최대 행/열 범위를 벗어나지 않는지 검증
function validateSeatSemantic(screening, seat) {
  const rowIndex = seat.row.charCodeAt(0) - 65; // A는 0, B는 1...
  return (
    rowIndex >= 0 &&
    rowIndex < screening.rows &&
    seat.col >= 1 &&
    seat.col <= screening.cols
  );
}

// 특정 영화 ID로 영화 제목 검색
function getMovieTitle(movieId, movies) {
  const movie = movies.find((m) => m.id === movieId);
  return movie ? movie.title : "알 수 없는 영화";
}

// 특정 상영 ID로 상영 객체 검색
function getScreeningById(screeningId, screenings) {
  return screenings.find((s) => s.id === screeningId);
}

// 파일 파싱 중 에러 발생 시 출력할 일관된 에러 메시지 생성 포맷
function makeFileError(fileName, lineNo, reason) {
  return `[파일 오류] ${fileName} ${lineNo}번째 줄: ${reason}`;
}

/* =========================
   파일 파싱 + 검증 (앱 초기화 핵심)
========================= */

// 프로그램 시작 시 모든 파일을 읽어들이고 정합성을 꼼꼼하게 검사하는 함수
function parseAndValidateFiles() {
  const moviesRaw = readRawLines(MOVIES_FILE);
  const screeningsRaw = readRawLines(SCREENINGS_FILE);
  const reservationsRaw = readRawLines(RESERVATIONS_FILE);

  // 영화 데이터가 없으면 진행 불가
  if (moviesRaw.length === 0) {
    throw new Error(
      "영화 정보 파일 내용 누락 오류: movies.txt 파일이 비어 있습니다.",
    );
  }

  // 상영 데이터가 없으면 진행 불가
  if (screeningsRaw.length === 0) {
    throw new Error("상영 정보 파일 내용이 비어있습니다.");
  }

  // 1. 영화 데이터 파싱 및 검증
  const movieIdSet = new Set();
  const movies = moviesRaw.map((line, i) => {
    const fields = line.split("|");

    if (fields.length !== 2) {
      throw new Error(
        makeFileError(
          MOVIES_FILE,
          i + 1,
          "데이터 형식이 올바르지 않습니다. (movieId|title) 예: M001|영화 제목",
        ),
      );
    }

    const [id, title] = fields;

    if (!validateMovieCodeSyntax(id)) {
      throw new Error(
        makeFileError(
          MOVIES_FILE,
          i + 1,
          `movieId(${id}) 형식이 올바르지 않습니다. 예: M001`,
        ),
      );
    }

    if (movieIdSet.has(id)) {
      throw new Error(
        makeFileError(MOVIES_FILE, i + 1, `중복된 movieId(${id})가 있습니다.`),
      );
    }

    if (!validateMovieTitleSyntax(title)) {
      throw new Error(
        makeFileError(
          MOVIES_FILE,
          i + 1,
          "영화 제목 형식이 올바르지 않습니다.",
        ),
      );
    }

    movieIdSet.add(id);
    return { id, title };
  });

  // 2. 상영 데이터 파싱 및 검증
  const screeningIdSet = new Set();
  const screenings = screeningsRaw.map((line, i) => {
    const fields = line.split("|");

    if (fields.length !== 7) {
      throw new Error(
        makeFileError(
          SCREENINGS_FILE,
          i + 1,
          "데이터 형식이 올바르지 않습니다. (screeningId|movieId|theater|date|time|rows|cols)",
        ),
      );
    }

    let [id, movieId, theater, date, time, rowsRaw, colsRaw] = fields;

    // 파일 내 날짜 포맷 엄격한 검사용 내부 함수
    function validateStrictDateSyntax(date) {
      return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date);
    }

    time = normalizeTimeRange(time);

    const rows = Number(rowsRaw);
    const cols = Number(colsRaw);

    if (!validateStrictDateSyntax(date)) {
      throw new Error(
        makeFileError(
          SCREENINGS_FILE,
          i + 1,
          `상영 날짜(${date}) 형식이 올바르지 않습니다. 예: 2026-03-25`,
        ),
      );
    }

    if (!validateScreeningCodeSyntax(id)) {
      throw new Error(
        makeFileError(
          SCREENINGS_FILE,
          i + 1,
          `screeningId(${id}) 형식이 올바르지 않습니다. 예: S001`,
        ),
      );
    }

    if (screeningIdSet.has(id)) {
      throw new Error(
        makeFileError(
          SCREENINGS_FILE,
          i + 1,
          `중복된 screeningId(${id})가 있습니다.`,
        ),
      );
    }

    if (!validateMovieCodeSyntax(movieId)) {
      throw new Error(
        makeFileError(
          SCREENINGS_FILE,
          i + 1,
          `movieId(${movieId}) 형식이 올바르지 않습니다. 예: M001`,
        ),
      );
    }

    // 존재하는 영화 ID인지 외래키(Foreign Key) 참조 무결성 검사
    if (!movieIdSet.has(movieId)) {
      throw new Error(
        makeFileError(
          SCREENINGS_FILE,
          i + 1,
          `존재하지 않는 movieId(${movieId}) 참조`,
        ),
      );
    }

    if (!validateTheaterSyntax(theater)) {
      throw new Error(
        makeFileError(
          SCREENINGS_FILE,
          i + 1,
          `상영관(${theater}) 형식이 올바르지 않습니다.`,
        ),
      );
    }

    if (!validateDateSemantic(date)) {
      throw new Error(
        makeFileError(
          SCREENINGS_FILE,
          i + 1,
          `상영 날짜(${date})가 올바르지 않습니다.`,
        ),
      );
    }

    if (
      !validateTimeRangeSyntax(time) ||
      !validateTimeSemantic(time) ||
      !validateMaxDuration(time)
    ) {
      throw new Error(
        makeFileError(
          SCREENINGS_FILE,
          i + 1,
          `상영 시간(${time})이 올바르지 않습니다(형식과 범위를 만족하지않거나 6시간을 초과합니다.). 예: 14:00 - 16:14`,
        ),
      );
    }

    // 1. 문법 검사
    if (!validateSeatGridSyntax(rowsRaw, colsRaw)) {
      throw new Error(
        makeFileError(
          SCREENINGS_FILE,
          i + 1,
          `좌석 형식(${rowsRaw}x${colsRaw})이 올바르지 않습니다. (행:1~26, 열:1~99)`,
        ),
      );
    }

    // 2. 의미 검사 (좌석 행/열 제한 범위)
    if (!validateSeatGridSemantic(rows, cols)) {
      throw new Error(
        makeFileError(
          SCREENINGS_FILE,
          i + 1,
          `좌석 범위(${rows}x${cols})가 올바르지 않습니다. (행:1~26, 열:1~99)`,
        ),
      );
    }

    screeningIdSet.add(id);
    return { id, movieId, theater, date, time, rows, cols };
  });

  // 상영관별 좌석 구조 일관성 검사 (1관이 10x10이면 다른 시간대의 1관도 10x10이어야 함)
  const theaterSeatMap = new Map();

  for (let i = 0; i < screenings.length; i++) {
    const s = screenings[i];
    const key = s.theater;
    const seatInfo = `${s.rows}x${s.cols}`;

    if (!theaterSeatMap.has(key)) {
      theaterSeatMap.set(key, seatInfo);
    } else {
      const existing = theaterSeatMap.get(key);
      if (existing !== seatInfo) {
        throw new Error(
          makeFileError(
            SCREENINGS_FILE,
            i + 1,
            `같은 상영관(${key}관)의 좌석 수가 일관되지 않습니다.`,
          ),
        );
      }
    }
  }

  // 같은 상영관에서 날짜를 넘어가는 경우까지 포함한 시간 겹침 검사
  for (let i = 0; i < screenings.length; i++) {
    for (let j = i + 1; j < screenings.length; j++) {
      const a = screenings[i];
      const b = screenings[j];

      // 다른 상영관이면 시간 겹쳐도 상관없음
      if (a.theater !== b.theater) continue;

      const rangeA = getAbsoluteRange(a);
      const rangeB = getAbsoluteRange(b);

      if (!rangeA || !rangeB) continue;

      // 같은 상영관에서 시간이 겹치면 에러
      if (isTimeOverlap(rangeA, rangeB)) {
        throw new Error(
          makeFileError(
            SCREENINGS_FILE,
            j + 1,
            `같은 상영관에서 시간이 겹칩니다. (${a.theater}관, ${b.date}, ${a.time} / ${b.time})`,
          ),
        );
      }
    }
  }

  // 3. 예약 데이터 파싱 및 검증
  const reservationIdSet = new Set();
  const reservations = reservationsRaw.map((line, i) => {
    const fields = line.split("|");

    if (fields.length !== 4) {
      throw new Error(
        makeFileError(
          RESERVATIONS_FILE,
          i + 1,
          "데이터 형식이 올바르지 않습니다. (reservationId|phone|screeningId|seat)",
        ),
      );
    }

    const [id, phone, screeningId, seatText] = fields;

    const parsedSeat = parseStoredSeat(seatText);
    if (!parsedSeat) {
      throw new Error(
        makeFileError(
          RESERVATIONS_FILE,
          i + 1,
          `좌석(${seatText}) 형식이 올바르지 않습니다. 예: A1, B3, C10`,
        ),
      );
    }

    const seatRow = parsedSeat.row;
    const seatCol = parsedSeat.col;

    if (!validateReservationCodeSyntax(id)) {
      throw new Error(
        makeFileError(
          RESERVATIONS_FILE,
          i + 1,
          `reservationId(${id}) 형식이 올바르지 않습니다. 예: R001`,
        ),
      );
    }

    if (reservationIdSet.has(id)) {
      throw new Error(
        makeFileError(
          RESERVATIONS_FILE,
          i + 1,
          `중복된 reservationId(${id})가 있습니다.`,
        ),
      );
    }

    if (!/^[0-9]+$/.test(phone) || !validatePhoneSyntax(phone)) {
      throw new Error(
        makeFileError(
          RESERVATIONS_FILE,
          i + 1,
          `전화번호(${phone}) 형식이 올바르지 않습니다.`,
        ),
      );
    }

    if (!validateScreeningCodeSyntax(screeningId)) {
      throw new Error(
        makeFileError(
          RESERVATIONS_FILE,
          i + 1,
          `screeningId(${screeningId}) 형식이 올바르지 않습니다. 예: S001`,
        ),
      );
    }

    // 존재하는 상영 ID인지 참조 검사
    if (!screeningIdSet.has(screeningId)) {
      throw new Error(
        makeFileError(
          RESERVATIONS_FILE,
          i + 1,
          `존재하지 않는 screeningId(${screeningId}) 참조`,
        ),
      );
    }

    const screening = screenings.find((s) => s.id === screeningId);
    const seat = { row: seatRow, col: seatCol };

    // 해당 상영관의 유효한 좌석 범위 내에 예약되었는지 검사
    if (!validateSeatSemantic(screening, seat)) {
      const maxRowChar = String.fromCharCode(64 + screening.rows);
      const maxCol = screening.cols;

      throw new Error(
        makeFileError(
          RESERVATIONS_FILE,
          i + 1,
          `존재하지 않는 좌석(${seatRow}${seatCol})입니다. 선택 가능한 범위: A1 ~ ${maxRowChar}${maxCol}`,
        ),
      );
    }

    reservationIdSet.add(id);
    return { id, phone, screeningId, seatRow, seatCol };
  });

  // 같은 상영에 같은 좌석 중복 예약 금지 (예약 무결성 체크)
  const reservedSeatSet = new Set();
  for (let i = 0; i < reservations.length; i++) {
    const r = reservations[i];
    const seatKey = `${r.screeningId}|${r.seatRow}|${r.seatCol}`;
    if (reservedSeatSet.has(seatKey)) {
      throw new Error(
        makeFileError(
          RESERVATIONS_FILE,
          i + 1,
          "이미 예매된 좌석이 중복 저장되어 있습니다.",
        ),
      );
    }
    reservedSeatSet.add(seatKey);
  }

  // 같은 전화번호로 시간이 겹치는 다른 상영 중복 예약 금지 (몸이 2개일 수 없음)
  for (let i = 0; i < reservations.length; i++) {
    for (let j = i + 1; j < reservations.length; j++) {
      const a = reservations[i];
      const b = reservations[j];

      if (!samePhone(a.phone, b.phone)) continue; // 폰 번호 다르면 패스
      if (a.screeningId === b.screeningId) continue; // 동일 상영 여러 좌석 예매는 허용

      const screeningA = getScreeningById(a.screeningId, screenings);
      const screeningB = getScreeningById(b.screeningId, screenings);

      if (!screeningA || !screeningB) continue;

      const rangeA = getAbsoluteRange(screeningA);
      const rangeB = getAbsoluteRange(screeningB);

      if (!rangeA || !rangeB) continue;

      if (isTimeOverlap(rangeA, rangeB)) {
        throw new Error(
          makeFileError(
            RESERVATIONS_FILE,
            j + 1,
            "동일 전화번호로 시간이 겹치는 상영이 중복 예매되어 있습니다.",
          ),
        );
      }
    }
  }

  // 모든 검증을 통과한 데이터 반환
  return { movies, screenings, reservations };
}

// 새로운 예매 시 고유 예약 ID 자동 생성 로직 (현재 최대값 + 1)
function generateReservationId(reservations) {
  const used = new Set(reservations.map((r) => r.id));

  for (let i = 0; i <= 999; i++) {
    const id = `R${String(i).padStart(3, "0")}`;
    if (!used.has(id)) return id;
  }

  throw new Error("더 이상 예매코드를 생성할 수 없습니다.");
}

/* =========================
   출력 뷰 (View)
========================= */

// 메인 메뉴 출력
function printMainMenu() {
  console.log("\n==============================");
  console.log("영화 예매 시스템");
  console.log("==============================");
  console.log("1. 영화 예매");
  console.log("2. 예매 내역 조회");
  console.log("3. 종료");
  console.log("==============================");
}

// 영화 리스트 출력
function printMovies(movies) {
  console.log("\n[영화 목록]");
  movies.forEach((movie, index) => {
    console.log(`${index + 1}. ${movie.title} (${movie.id})`);
  });
}

// 선택 가능한 상영 목록 출력
function printScreenings(screenings, movies) {
  console.log("\n[상영 정보]");
  screenings.forEach((s, index) => {
    const totalSeats = s.rows * s.cols;

    console.log(
      `${index + 1}. ${getMovieTitle(s.movieId, movies)} | ${s.theater}관 | ${s.date} | ${s.time} | 총 ${totalSeats}석`,
    );
  });
}

// 좌석 배치도 콘솔 드로잉 (O: 빈자리, X: 예약됨)
function displaySeats(screening, reservations) {
  const reservedSeats = reservations.filter(
    (r) => r.screeningId === screening.id,
  );

  console.log("\n[좌석 배치도]");
  process.stdout.write("    ");
  // 열 번호 출력 (상단)
  for (let c = 1; c <= screening.cols; c++) {
    process.stdout.write(String(c).padStart(2, " ") + " ");
  }
  console.log();

  // 각 행별로 알파벳과 좌석 상태 출력
  for (let r = 0; r < screening.rows; r++) {
    const rowChar = String.fromCharCode(65 + r);
    process.stdout.write(`${rowChar} | `);

    for (let c = 1; c <= screening.cols; c++) {
      const isReserved = reservedSeats.some(
        (seat) => seat.seatRow === rowChar && seat.seatCol === c,
      );
      process.stdout.write((isReserved ? "X" : "O") + "  ");
    }
    console.log();
  }

  console.log("O: 예약 가능, X: 예약됨");
}

/* =========================
   예매 흐름 단계별 함수
========================= */

// 1단계: 영화 선택
async function selectMovieStep(state) {
  printMovies(state.movies);

  while (true) {
    const input = await askInput("영화 번호를 선택하세요: ");
    if (isControl(input)) return input;

    const idx = Number(input);
    if (!Number.isInteger(idx) || idx < 1 || idx > state.movies.length) {
      console.log("올바른 영화 번호를 입력하세요.");
      continue;
    }

    const movie = state.movies[idx - 1];
    const movieScreenings = state.screenings.filter(
      (s) => s.movieId === movie.id,
    );

    // 해당 영화에 등록된 상영 스케줄이 아예 없는 경우 방어
    if (movieScreenings.length === 0) {
      console.log("선택한 영화의 상영 정보가 없습니다.");
      continue;
    }

    return movie;
  }
}

// 2단계: 날짜 직접 입력 선택
async function selectDateStep(movieScreenings) {
  // 선택한 영화가 상영하는 날짜 목록 추출 (중복 제거 및 정렬)
  const dates = [...new Set(movieScreenings.map((s) => s.date))].sort();

  console.log("\n[상영 가능 날짜]");
  dates.forEach((d) => console.log(`- ${d}`));

  while (true) {
    const input = await askInput(
      "상영 날짜를 입력하세요 (예: 20260325, 2026-03-25, -202-6-0-3-2-5): ",
    );
    if (isControl(input)) return input;

    if (!validateFlexibleDateSyntax(input)) {
      console.log(
        "날짜 형식이 올바르지 않습니다. 숫자 8개와 '-'만 사용할 수 있으며, '-'는 아무 위치에나 올 수 있습니다.",
      );
      continue;
    }

    const normalizedDate = normalizeDateInput(input);

    if (!validateDateSemantic(normalizedDate)) {
      console.log(
        "존재하지 않는 날짜입니다. YYYY는 2000년 이상이어야 하며, MM/DD는 실제 달력에 존재해야 합니다.",
      );
      continue;
    }

    if (!dates.includes(normalizedDate)) {
      console.log("해당 날짜에는 선택한 영화의 상영 정보가 없습니다.");
      continue;
    }

    return normalizedDate;
  }
}

// 3단계: 시간표(상영) 선택
async function selectScreeningStep(filteredScreenings, movies) {
  printScreenings(filteredScreenings, movies);

  while (true) {
    const input = await askInput("상영 번호를 선택하세요: ");
    if (isControl(input)) return input;

    const idx = Number(input);
    if (!Number.isInteger(idx) || idx < 1 || idx > filteredScreenings.length) {
      console.log("올바른 상영 번호를 입력하세요.");
      continue;
    }

    return filteredScreenings[idx - 1];
  }
}

// 예매 시 전화번호 기반 중복/겹침 예약 방지 체크
function hasTimeConflict(phone, selectedScreening, reservations, screenings) {
  const selectedRange = parseTimeRange(selectedScreening.time);
  if (!selectedRange) return false;

  return reservations.some((r) => {
    if (!samePhone(r.phone, phone)) return false;
    // 같은 상영이면 같은 전화번호로 여러 좌석 예약 허용 (일행 예약)
    if (r.screeningId === selectedScreening.id) return false;

    const reservedScreening = getScreeningById(r.screeningId, screenings);
    if (!reservedScreening) return false;

    const selectedAbs = getAbsoluteRange(selectedScreening);
    const reservedAbs = getAbsoluteRange(reservedScreening);

    if (!selectedAbs || !reservedAbs) return false;

    return isTimeOverlap(selectedAbs, reservedAbs);
  });
}

// 4단계: 전화번호 입력
async function inputPhoneStep(state, selectedScreening) {
  while (true) {
    const input = await askInput("전화번호를 입력하세요: ");
    if (isControl(input)) return input;

    if (!validatePhoneSyntax(input)) {
      console.log("전화번호 형식이 올바르지 않습니다.");
      continue;
    }

    // 예매하려는 시간대와 기존 예매 시간대 충돌 확인
    if (
      hasTimeConflict(
        input,
        selectedScreening,
        state.reservations,
        state.screenings,
      )
    ) {
      console.log(
        "해당 전화번호로 같은 날짜/겹치는 시간대의 예매가 이미 있습니다.",
      );
      continue;
    }

    return normalizePhone(input);
  }
}

// 특정 좌석이 이미 예매되었는지 확인
function isSeatReserved(screeningId, seat, reservations) {
  return reservations.some(
    (r) =>
      r.screeningId === screeningId &&
      r.seatRow === seat.row &&
      r.seatCol === seat.col,
  );
}

// 5단계: 좌석 선택
async function selectSeatStep(state, selectedScreening) {
  while (true) {
    displaySeats(selectedScreening, state.reservations);

    const maxRowChar = String.fromCharCode(64 + selectedScreening.rows);

    const input = await askInput(
      `좌석을 입력하세요 (예: A1 ~ ${maxRowChar}${selectedScreening.cols}): `,
    );
    if (isControl(input)) return input;

    const seat = parseSeatInput(input);

    if (!seat) {
      console.log("좌석 입력 형식이 올바르지 않습니다. 예: A1, B3, C10");
      console.log(
        "좌석 행은 대문자만 입력 가능하며, 한 자리 좌석번호는 A01처럼 0을 붙일 수 없습니다.",
      );
      continue;
    }

    if (!validateSeatSemantic(selectedScreening, seat)) {
      console.log(
        `좌석 범위를 벗어났습니다. 선택 가능한 좌석은 A1 ~ ${maxRowChar}${selectedScreening.cols} 입니다.`,
      );
      continue;
    }

    if (isSeatReserved(selectedScreening.id, seat, state.reservations)) {
      console.log("이미 예매된 좌석입니다. 다시 선택하세요.");
      continue;
    }

    return seat;
  }
}

// 6단계: 최종 예매 정보 확인
async function confirmReservationStep(
  selectedMovie,
  selectedScreening,
  phone,
  seat,
) {
  console.log("\n[예매 확인]");
  console.log(`영화: ${selectedMovie.title}`);
  console.log(`상영관: ${selectedScreening.theater}관`);
  console.log(`날짜: ${selectedScreening.date}`);
  console.log(`시간: ${selectedScreening.time}`);
  console.log(`좌석: ${seat.row}${seat.col}`);
  console.log(`전화번호: ${phone}`);

  while (true) {
    const input = await askInput(
      "예매를 확정하시겠습니까? (y/n 또는 yes/no): ",
    );
    if (isControl(input)) return input;

    if (input === "y" || input === "yes") return true;
    if (input === "n" || input === "no") return false;

    console.log("y/n 또는 yes/no를 입력하세요.");
  }
}

// 최종 예매 정보를 메모리 및 파일에 저장
function saveReservation(state, phone, screeningId, seat) {
  const newId = generateReservationId(state.reservations);

  const newReservation = {
    id: newId,
    phone,
    screeningId,
    seatRow: seat.row,
    seatCol: seat.col,
  };

  state.reservations.push(newReservation);

  const lines = state.reservations.map(
    (r) => `${r.id}|${r.phone}|${r.screeningId}|${r.seatRow}${r.seatCol}`,
  );
  writeLines(RESERVATIONS_FILE, lines); // 파일 덮어쓰기
}

/* =========================
   메인 흐름 제어 (Flows)
========================= */

// 영화 예매 전체 시나리오를 관리하는 흐름
async function reserveMovieFlow(state) {
  let step = 1; // 현재 진행 단계 추적용 변수

  let selectedMovie = null;
  let selectedDate = null;
  let selectedScreening = null;
  let phone = null;
  let seat = null;

  while (true) {
    if (step === 1) {
      const result = await selectMovieStep(state);

      if (isControl(result)) {
        if (result.command === CMD.MAIN) return result;
        if (result.command === CMD.BACK) return undefined; // 메뉴로 복귀
      } else {
        selectedMovie = result;
        step = 2; // 다음 단계 진행
      }
    } else if (step === 2) {
      const movieScreenings = state.screenings.filter(
        (s) => s.movieId === selectedMovie.id,
      );

      const result = await selectDateStep(movieScreenings);

      if (isControl(result)) {
        if (result.command === CMD.MAIN) return result;
        if (result.command === CMD.BACK) {
          step = 1; // 이전 단계로 복귀
          continue;
        }
      } else {
        selectedDate = result;
        step = 3;
      }
    } else if (step === 3) {
      const filteredScreenings = state.screenings.filter(
        (s) => s.movieId === selectedMovie.id && s.date === selectedDate,
      );

      if (filteredScreenings.length === 0) {
        console.log("선택한 날짜의 상영 정보가 없습니다.");
        step = 2; // 방어 로직: 다시 날짜 선택으로
        continue;
      }

      const result = await selectScreeningStep(
        filteredScreenings,
        state.movies,
      );

      if (isControl(result)) {
        if (result.command === CMD.MAIN) return result;
        if (result.command === CMD.BACK) {
          step = 2;
          continue;
        }
      } else {
        selectedScreening = result;
        step = 4;
      }
    } else if (step === 4) {
      const result = await inputPhoneStep(state, selectedScreening);

      if (isControl(result)) {
        if (result.command === CMD.MAIN) return result;
        if (result.command === CMD.BACK) {
          step = 3;
          continue;
        }
      } else {
        phone = result;
        step = 5;
      }
    } else if (step === 5) {
      const result = await selectSeatStep(state, selectedScreening);

      if (isControl(result)) {
        if (result.command === CMD.MAIN) return result;
        if (result.command === CMD.BACK) {
          step = 4;
          continue;
        }
      } else {
        seat = result;
        step = 6;
      }
    } else if (step === 6) {
      const result = await confirmReservationStep(
        selectedMovie,
        selectedScreening,
        phone,
        seat,
      );

      if (isControl(result)) {
        if (result.command === CMD.MAIN) return result;
        if (result.command === CMD.BACK) {
          step = 5;
          continue;
        }
      } else if (result === false) {
        console.log("예매가 취소되었습니다.");
        step = 5; // 거절 시 다시 좌석 선택으로
      } else {
        saveReservation(state, phone, selectedScreening.id, seat);
        console.log("예매가 완료되었습니다.");
        return undefined; // 정상 종료 후 메인 메뉴로
      }
    }
  }
}

// 예매 내역 조회 시나리오
async function lookupReservationFlow(state) {
  while (true) {
    const input = await askInput("조회할 전화번호를 입력하세요: ");
    if (isControl(input)) return input;

    if (!validatePhoneSyntax(input)) {
      console.log("전화번호 형식이 올바르지 않습니다.");
      continue;
    }

    // 동일 폰번호로 예매된 모든 내역 필터링
    const myReservations = state.reservations.filter((r) =>
      samePhone(r.phone, input),
    );

    if (myReservations.length === 0) {
      console.log("해당 전화번호로 예매된 내역이 없습니다.");
      return undefined;
    }

    console.log("\n[예매 내역 조회]");
    myReservations.forEach((r, index) => {
      const screening = getScreeningById(r.screeningId, state.screenings);
      if (!screening) {
        console.log(`${index + 1}. 잘못된 상영 정보`);
        return;
      }

      const movieTitle = getMovieTitle(screening.movieId, state.movies);
      console.log(
        `${index + 1}. 영화: ${movieTitle} | 상영관: ${screening.theater}관 | 날짜: ${screening.date} | 시간: ${screening.time} | 좌석: ${r.seatRow}${r.seatCol} | 예매코드: ${r.id}`,
      );
    });

    return undefined;
  }
}

// 프로그램 시작 시 필수 파일 유무 검사 (예약 파일은 없으면 자동 생성)
function checkRequiredFiles() {
  if (!fs.existsSync(SCREENINGS_FILE)) {
    console.log("상영 정보 파일이 존재하지 않습니다.");
    rl.close();
    process.exit(1); // 치명적 에러로 인한 종료
  }

  if (!fs.existsSync(MOVIES_FILE)) {
    console.log("영화 정보 파일이 존재하지 않습니다.");
    rl.close();
    process.exit(1);
  }

  // 예매 내역 파일은 실행 과정에서 생성될 수 있으므로 빈 파일로 초기화
  if (!fs.existsSync(RESERVATIONS_FILE)) {
    fs.writeFileSync(RESERVATIONS_FILE, "", "utf8");
  }
}

// 진입점 (Entry Point)
async function main() {
  checkRequiredFiles();

  let state;
  try {
    // 텍스트 데이터를 메모리로 로드하고 검증
    state = parseAndValidateFiles();
  } catch (error) {
    // 파일 내용 파싱/검증 중 에러 발생 시 프로그램 종료
    console.error(error.message);
    rl.close();
    return;
  }

  // 메인 이벤트 루프
  while (true) {
    printMainMenu();

    // 메인에서는 back, main 명령어가 불필요하므로 옵션으로 비활성화
    const choice = await askInput(
      "명령어를 보고싶으시면 help, 또는 메뉴 번호를 입력하세요: ",
      { allowBack: false, allowMain: false },
    );

    // help 등의 명령어는 askInput 안에서 처리되고 control 객체가 올라옴
    if (isControl(choice)) {
      continue;
    }

    switch (choice) {
      case "1": {
        const control = await reserveMovieFlow(state);
        // 하위 flow에서 main 명령어로 빠져나왔을 때 루프 재시작 처리
        if (isControl(control) && control.command === CMD.MAIN) {
          continue;
        }
        break;
      }

      case "2": {
        const control = await lookupReservationFlow(state);
        if (isControl(control) && control.command === CMD.MAIN) {
          continue;
        }
        break;
      }

      case "3":
        safeExit(); // 3번 선택 시 종료
        return;

      default:
        console.log("올바른 메뉴 번호를 입력하세요.");
    }
  }
}

// 프로그램 실행
main();
