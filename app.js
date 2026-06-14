const fs = require("fs");
const readline = require("readline");

const MOVIES_FILE = "movies.txt";
const SCREENINGS_FILE = "screenings.txt";
const THEATERS_FILE = "theaters.txt";
const DISABLED_SEATS_FILE = "disabled-seats.txt";
const RESERVATIONS_FILE = "reservations.txt";
// 설계 문서에 명시된 관리자 비밀번호
const ADMIN_PASSWORD = "admin1234";

const CMD = { HELP: "help", QUIT: "quit", BACK: "back", MAIN: "main" };
const CTRL = {
  BACK: { type: "control", command: CMD.BACK },
  MAIN: { type: "control", command: CMD.MAIN },
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// 텍스트 파일에서 비어 있지 않은 줄 읽기
function readRawLines(fileName) {
  const content = fs.readFileSync(fileName, "utf8");
  if (!content.trim()) return [];
  return content.split(/\r?\n/).filter((line) => line.length > 0);
}

// 줄 목록을 텍스트 파일에 저장
function writeLines(fileName, lines) {
  fs.writeFileSync(fileName, lines.join("\n"), "utf8");
}

// 전체 명령어 도움말 출력
function printHelp() {
  console.log("\n[도움말]");
  console.log("help : 도움말 보기");
  console.log("quit : 프로그램 종료");
  console.log("back : 이전 단계로 이동");
  console.log("main : 메인 메뉴로 이동");
}

// 입력 종료 후 프로그램 종료
function safeExit() {
  console.log("프로그램을 종료합니다.");
  rl.close();
  process.exit(0);
}

// 사용자 입력의 모든 공백 제거
function normalizeInput(input) {
  return input.replace(/\s+/g, "");
}

// 영화 제목 입력의 앞뒤 공백 제거
function normalizeMovieTitleInput(input) {
  return input.trim();
}

// 질문 출력 후 원본 답변 정규화
function askRaw(question, normalizer = normalizeInput) {
  return new Promise((resolve) =>
    rl.question(question, (answer) => resolve(normalizer(answer))),
  );
}

// 유효한 명령이나 입력을 받을 때까지 반복 질문
async function askWithNormalizer(
  question,
  options = {},
  normalizer = normalizeInput,
) {
  const { allowBack = true, allowMain = true } = options;
  while (true) {
    const input = await askRaw(question, normalizer);
    if (!input) {
      console.log(
        "빈 입력은 허용되지 않습니다. back/main/help/quit 또는 올바른 값을 입력하세요.",
      );
      continue;
    }
    if (input === CMD.HELP) {
      printHelp();
      continue;
    }
    if (input === CMD.QUIT) safeExit();
    if (input === CMD.BACK) {
      if (!allowBack) {
        console.log("이미 최상위 단계입니다.");
        continue;
      }
      return CTRL.BACK;
    }
    if (input === CMD.MAIN) {
      if (!allowMain) {
        console.log("이미 메인 메뉴입니다.");
        continue;
      }
      return CTRL.MAIN;
    }
    return input;
  }
}

// 일반 입력 수신 및 정규화
function askInput(question, options = {}) {
  return askWithNormalizer(question, options);
}

// 영화 제목 입력 수신 및 제목 규칙 정규화
function askMovieTitle(question, options = {}) {
  return askWithNormalizer(question, options, normalizeMovieTitleInput);
}

// 화면 이동 제어 명령 여부 확인
function isControl(value) {
  return value && typeof value === "object" && value.type === "control";
}

// 영화 코드 형식 검증
function validateMovieCodeSyntax(code) {
  return /^M[0-9]{3}$/.test(code);
}

// 상영 코드 형식 검증
function validateScreeningCodeSyntax(code) {
  return /^S[0-9]{3}$/.test(code);
}

// 예매 코드 형식 검증
function validateReservationCodeSyntax(code) {
  return /^R[0-9]{3}$/.test(code);
}

// 사용 금지 좌석 코드 형식 검증
function validateDisabledSeatCodeSyntax(code) {
  return /^D[0-9]{3}$/.test(code);
}

// 상영관 코드 형식 검증
function validateTheaterCodeSyntax(code) {
  return /^T[1-9]$/.test(code);
}

// 상영관 코드 문법 검증
function validateTheaterSyntax(code) {
  return validateTheaterCodeSyntax(code);
}

// 영화 제목의 데이터 파일 저장 가능 여부 확인
function validateMovieTitleSyntax(title) {
  return (
    typeof title === "string" &&
    title.length > 0 &&
    !/^\s/.test(title) &&
    title.trim().length > 0 &&
    !/[|\r\n]/.test(title)
  );
}

// 상영 시간의 1~360분 정수 여부 확인
function validateRunningTime(value) {
  return /^[1-9][0-9]*$/.test(String(value)) && Number(value) <= 360;
}

// 최대 범위 안의 양의 정수 여부 확인
function validatePositiveIntegerInRange(value, max) {
  return /^[1-9][0-9]*$/.test(String(value)) && Number(value) <= max;
}

// YYYY-MM-DD 날짜 형식 검증
function validateDateSyntax(date) {
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date);
}

// 하이픈 선택 포함 8자리 날짜 입력 검증
function validateFlexibleDateSyntax(input) {
  return /^-*(\d-*){8}$/.test(input);
}

// 유연한 날짜 입력을 YYYY-MM-DD 형식으로 변환
function normalizeDateInput(input) {
  const digits = input.replace(/-/g, "");
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

// 날짜의 실제 달력 존재 여부 확인
function validateDateSemantic(date) {
  if (!validateDateSyntax(date)) return false;
  const [year, month, day] = date.split("-").map(Number);
  if (year < 2000 || month < 1 || month > 12) return false;
  return day >= 1 && day <= new Date(year, month, 0).getDate();
}

// 24시간 HH:MM 시작 시간 형식 검증
function validateStartTimeSyntax(value) {
  return /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(value);
}

// HH:MM - HH:MM 시간 범위 형식 검증
function validateTimeRangeSyntax(value) {
  return /^([0-1][0-9]|2[0-3]):[0-5][0-9] - ([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(
    value,
  );
}

// HH:MM 시간을 자정 이후 분 단위로 변환
function timeToMinutes(value) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

// 시간 범위를 시작과 종료 분 값으로 파싱
function parseTimeRange(value) {
  if (!validateTimeRangeSyntax(value)) return null;
  const [startText, endText] = value.split(" - ");
  const start = timeToMinutes(startText);
  let end = timeToMinutes(endText);
  if (end <= start) end += 24 * 60;
  return { start, end };
}

// 시간 범위의 최대 6시간 이내 여부 확인
function validateMaxDuration(value) {
  const range = parseTimeRange(value);
  return Boolean(range && range.end - range.start <= 360);
}

// 날짜와 시간 문자열로 로컬 Date 객체 생성
function makeLocalDateTime(dateString, timeString) {
  const [year, month, day] = dateString.split("-").map(Number);
  const [hour, minute] = timeString.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

// 상영 정보의 시작과 종료 Date 범위 반환
function getScreeningDateTimeRange(screening) {
  const [startText, endText] = screening.time.split(" - ");
  const start = makeLocalDateTime(screening.date, startText);
  const end = makeLocalDateTime(screening.date, endText);
  if (end <= start) end.setDate(end.getDate() + 1);
  return { start, end };
}

// 상영 정보의 절대 날짜-시간 범위 반환
function getAbsoluteRange(screening) {
  return getScreeningDateTimeRange(screening);
}

// 두 날짜-시간 범위의 겹침 여부 확인
function isTimeOverlap(rangeA, rangeB) {
  return rangeA.start < rangeB.end && rangeB.start < rangeA.end;
}

// Date 객체를 HH:MM 형식으로 변환
function formatTime(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

// Date 객체를 YYYY-MM-DD 형식으로 변환
function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Date 객체를 YYYY-MM-DD HH:MM 형식으로 변환
function formatDateTime(date) {
  return `${formatDate(date)} ${formatTime(date)}`;
}

// 시작 시간과 상영 시간으로 상영 시간 범위 생성
function formatTimeRangeFromStartAndRunningTime(
  startTime,
  runningTime,
  date = "2000-01-01",
) {
  const start = makeLocalDateTime(date, startTime);
  const end = new Date(start.getTime() + Number(runningTime) * 60 * 1000);
  return `${startTime} - ${formatTime(end)}`;
}

// 사용 금지 좌석의 적용 날짜-시간 범위 반환
function getDisabledSeatDateRange(disabledSeat) {
  const start = makeLocalDateTime(disabledSeat.startDate, "00:00");
  const end = makeLocalDateTime(disabledSeat.endDate, "00:00");
  end.setDate(end.getDate() + 1);
  return { start, end };
}

// 상영 시작 또는 경과 여부 확인
function isScreeningStartedOrPast(screening, state) {
  return getScreeningDateTimeRange(screening).start <= state.currentDateTime;
}

// 상영 종료 여부 확인
function isScreeningEnded(screening, state) {
  return getScreeningDateTimeRange(screening).end <= state.currentDateTime;
}

// 현재 상영 진행 여부 확인
function isScreeningNowPlaying(screening, state) {
  const range = getScreeningDateTimeRange(screening);
  return (
    range.start <= state.currentDateTime && state.currentDateTime < range.end
  );
}

// 상영 예매 가능 여부 확인
function isScreeningBookable(screening, state) {
  return getScreeningDateTimeRange(screening).start > state.currentDateTime;
}

// 좌석 행 문자를 1부터 시작하는 숫자로 변환
function rowCharToNumber(rowChar) {
  return rowChar.charCodeAt(0) - 64;
}

// 1부터 시작하는 행 번호를 좌석 행 문자로 변환
function rowNumberToChar(rowNumber) {
  return String.fromCharCode(64 + rowNumber);
}

// 상영관 ID에서 표시용 번호 추출
function getTheaterDisplayNumber(theaterId) {
  return theaterId.slice(1);
}

// ID로 상영관 조회
function getTheaterById(theaterId, theaters) {
  return theaters.find((theater) => theater.id === theaterId);
}

// ID로 영화 조회
function getMovieById(movieId, movies) {
  return movies.find((movie) => movie.id === movieId);
}

// 영화 제목 조회 또는 대체 문구 반환
function getMovieTitle(movieId, movies) {
  const movie = getMovieById(movieId, movies);
  return movie ? movie.title : "알 수 없는 영화";
}

// ID로 상영 정보 조회
function getScreeningById(screeningId, screenings) {
  return screenings.find((screening) => screening.id === screeningId);
}

// 좌석 입력을 행과 열 값으로 파싱
function parseSeatInput(input) {
  const match = input.match(/^([A-Z])([1-9][0-9]?)$/);
  return match ? { row: match[1], col: Number(match[2]) } : null;
}

// 좌석의 상영관 범위 내 존재 여부 확인
function validateSeatSemantic(theater, seat) {
  const row = rowCharToNumber(seat.row);
  return (
    row >= 1 && row <= theater.rows && seat.col >= 1 && seat.col <= theater.cols
  );
}

// 허용 전화번호 형식 검증
function validatePhoneSyntax(phone) {
  if (!/^[0-9-]+$/.test(phone)) return false;
  const digits = phone.replace(/-/g, "");
  if (digits.length < 6) return false;
  if (digits.startsWith("010")) return digits.length === 11;
  if (digits.startsWith("01") && digits.length >= 3 && digits[2] !== "0") {
    return digits.length === 10 || digits.length === 11;
  }
  return true;
}

// 전화번호에서 하이픈 제거
function normalizePhone(phone) {
  return phone.replace(/-/g, "");
}

// 두 전화번호 정규화 후 비교
function samePhone(a, b) {
  return normalizePhone(a) === normalizePhone(b);
}

// 상영의 특정 좌석 예매 여부 확인
function isSeatReserved(screeningId, seat, reservations) {
  return reservations.some(
    (reservation) =>
      reservation.screeningId === screeningId &&
      reservation.seatRow === seat.row &&
      reservation.seatCol === seat.col,
  );
}

// 상영 시간의 특정 좌석 사용 금지 여부 확인
function isSeatDisabled(screening, seat, state) {
  const screeningRange = getScreeningDateTimeRange(screening);
  const row = rowCharToNumber(seat.row);
  return state.disabledSeats.some(
    (disabledSeat) =>
      disabledSeat.theaterId === screening.theaterId &&
      disabledSeat.row === row &&
      disabledSeat.col === seat.col &&
      isTimeOverlap(screeningRange, getDisabledSeatDateRange(disabledSeat)),
  );
}

// 데이터 파일 줄 검증 오류 메시지 생성
function makeFileError(fileName, lineNo, reason) {
  return `[파일 오류] ${fileName} ${lineNo}번째 줄: ${reason}`;
}

// 영화 파일 레코드 파싱 및 검증
function parseMoviesRawLines(lines) {
  if (lines.length === 0)
    throw new Error(
      "영화 정보 파일 내용 누락 오류: movies.txt 파일이 비어 있습니다.",
    );

  const ids = new Set();
  return lines.map((line, index) => {
    const fields = line.split("|");
    if (fields.length !== 3)
      throw new Error(
        makeFileError(
          MOVIES_FILE,
          index + 1,
          "데이터 형식이 올바르지 않습니다. (movieId|title|movieTime) 예: M001|영화 제목|러닝타임",
        ),
      );
    const [id, title, runningTimeText] = fields;
    if (!validateMovieCodeSyntax(id))
      throw new Error(
        makeFileError(
          MOVIES_FILE,
          index + 1,
          `movieId(${id}) 형식이 올바르지 않습니다. 예: M001`,
        ),
      );
    if (ids.has(id))
      throw new Error(
        makeFileError(
          MOVIES_FILE,
          index + 1,
          `중복된 movieId(${id})가 있습니다.`,
        ),
      );
    if (!validateMovieTitleSyntax(title))
      throw new Error(
        makeFileError(
          MOVIES_FILE,
          index + 1,
          "영화 제목 형식이 올바르지 않습니다.",
        ),
      );
    if (!validateRunningTime(runningTimeText))
      throw new Error(
        makeFileError(
          MOVIES_FILE,
          index + 1,
          "영화 러닝타임 형식이 올바르지 않습니다.",
        ),
      );
    ids.add(id);
    return { id, title, runningTime: Number(runningTimeText) };
  });
}

// 상영관 파일 레코드 파싱 및 검증
function parseTheatersRawLines(lines) {
  if (lines.length === 0)
    throw new Error("상영관 정보 파일 내용이 비어있습니다");

  const ids = new Set();
  return lines.map((line, index) => {
    const fields = line.split("|");
    if (fields.length !== 3)
      throw new Error(
        makeFileError(
          THEATERS_FILE,
          index + 1,
          "데이터 형식이 올바르지 않습니다. (theaterId|rows|cols)",
        ),
      );
    const [id, rowsText, colsText] = fields;
    if (!validateTheaterCodeSyntax(id))
      throw new Error(
        makeFileError(
          THEATERS_FILE,
          index + 1,
          `theaterId(${id}) 형식이 올바르지 않습니다. 예: T1`,
        ),
      );
    if (ids.has(id))
      throw new Error(
        makeFileError(
          THEATERS_FILE,
          index + 1,
          `중복된 theaterId(${id})가 있습니다.`,
        ),
      );
    if (!validatePositiveIntegerInRange(rowsText, 26))
      throw new Error(
        makeFileError(
          THEATERS_FILE,
          index + 1,
          `좌석 형식(${rowsText}x${colsText})이 올바르지 않습니다. (자연수여야함, 앞자리 0 금지)`,
        ),
      );
    if (!validatePositiveIntegerInRange(colsText, 99))
      throw new Error(
        makeFileError(
          THEATERS_FILE,
          index + 1,
          `좌석 정보(${rowsText}x${colsText})가 올바르지 않습니다.`,
        ),
      );
    ids.add(id);
    return { id, rows: Number(rowsText), cols: Number(colsText) };
  });
}

// 상영 정보 파일 레코드 파싱 및 검증
function parseScreeningsRawLines(lines, movies, theaters) {
  if (lines.length === 0) throw new Error("상영정보 파일 내용이 비어있습니다");

  const ids = new Set();
  const screenings = lines.map((line, index) => {
    const fields = line.split("|");
    if (fields.length !== 5)
      throw new Error(
        makeFileError(
          SCREENINGS_FILE,
          index + 1,
          "데이터 형식이 올바르지 않습니다. (screeningId|movieId|theaterId|date|time)",
        ),
      );
    const [id, movieId, theaterId, date, time] = fields;
    if (!validateScreeningCodeSyntax(id))
      throw new Error(
        makeFileError(
          SCREENINGS_FILE,
          index + 1,
          `screeningId(${id}) 형식이 올바르지 않습니다. 예: S001`,
        ),
      );
    if (ids.has(id))
      throw new Error(
        makeFileError(
          SCREENINGS_FILE,
          index + 1,
          `중복된 screeningId(${id})가 있습니다.`,
        ),
      );
    if (!validateMovieCodeSyntax(movieId))
      throw new Error(
        makeFileError(
          SCREENINGS_FILE,
          index + 1,
          `movieId(${movieId}) 형식이 올바르지 않습니다. 예: M001`,
        ),
      );
    const movie = getMovieById(movieId, movies);
    if (!movie)
      throw new Error(
        makeFileError(
          SCREENINGS_FILE,
          index + 1,
          `존재하지 않는 movieId(${movieId}) 참조`,
        ),
      );
    if (!validateTheaterCodeSyntax(theaterId))
      throw new Error(
        makeFileError(
          SCREENINGS_FILE,
          index + 1,
          `theaterId(${theaterId}) 형식이 올바르지 않습니다. 예: T1`,
        ),
      );
    if (!getTheaterById(theaterId, theaters))
      throw new Error(
        makeFileError(
          SCREENINGS_FILE,
          index + 1,
          `존재하지 않는 theaterId(${theaterId}) 참조`,
        ),
      );
    if (!validateDateSyntax(date))
      throw new Error(
        makeFileError(
          SCREENINGS_FILE,
          index + 1,
          `상영 날짜(${date}) 형식이 올바르지 않습니다. 예: 2026-03-25`,
        ),
      );
    if (!validateDateSemantic(date))
      throw new Error(
        makeFileError(
          SCREENINGS_FILE,
          index + 1,
          `상영 날짜(${date})가 올바르지 않습니다.`,
        ),
      );
    const range = parseTimeRange(time);
    if (!range || !validateMaxDuration(time))
      throw new Error(
        makeFileError(
          SCREENINGS_FILE,
          index + 1,
          `상영 시간(${time})이 올바르지 않습니다. (형식과 범위를 만족하지 않거나 6시간을 초과합니다.) 예: 14:00 - 16:14`,
        ),
      );
    if (range.end - range.start !== movie.runningTime)
      throw new Error(
        makeFileError(
          SCREENINGS_FILE,
          index + 1,
          "상영 시간이 영화 러닝타임과 일치하지 않습니다.",
        ),
      );
    ids.add(id);
    return { id, movieId, theaterId, date, time };
  });
  for (let i = 0; i < screenings.length; i += 1) {
    for (let j = i + 1; j < screenings.length; j += 1) {
      if (
        screenings[i].theaterId === screenings[j].theaterId &&
        isTimeOverlap(
          getAbsoluteRange(screenings[i]),
          getAbsoluteRange(screenings[j]),
        )
      ) {
        throw new Error(
          makeFileError(
            SCREENINGS_FILE,
            j + 1,
            `같은 상영관/날짜의 시간이 겹칩니다. (${getTheaterDisplayNumber(screenings[j].theaterId)}관, ${screenings[j].date}, ${screenings[i].time} / ${screenings[j].time})`,
          ),
        );
      }
    }
  }
  return screenings;
}

// 사용 금지 좌석 파일 레코드 파싱 및 검증
function parseDisabledSeatsRawLines(lines, theaters) {
  if (lines.length === 0) return [];

  const ids = new Set();
  const disabledSeats = lines.map((line, index) => {
    const fields = line.split("|");
    if (fields.length !== 6)
      throw new Error(
        makeFileError(
          DISABLED_SEATS_FILE,
          index + 1,
          "데이터 형식이 올바르지 않습니다. (disabledId|theaterId|row|col|startDate|endDate)",
        ),
      );
    const [id, theaterId, rowText, colText, startDate, endDate] = fields;
    if (!validateDisabledSeatCodeSyntax(id))
      throw new Error(
        makeFileError(
          DISABLED_SEATS_FILE,
          index + 1,
          `disabledId(${id}) 형식이 올바르지 않습니다. 예: D021`,
        ),
      );
    if (ids.has(id))
      throw new Error(
        makeFileError(
          DISABLED_SEATS_FILE,
          index + 1,
          `중복된 disabledId(${id})가 있습니다.`,
        ),
      );
    if (!validateTheaterCodeSyntax(theaterId))
      throw new Error(
        makeFileError(
          DISABLED_SEATS_FILE,
          index + 1,
          `theaterId(${theaterId}) 형식이 올바르지 않습니다. 예: T1`,
        ),
      );
    const theater = getTheaterById(theaterId, theaters);
    if (!theater)
      throw new Error(
        makeFileError(
          DISABLED_SEATS_FILE,
          index + 1,
          `존재하지 않는 theaterId(${theaterId}) 참조`,
        ),
      );
    if (!validatePositiveIntegerInRange(rowText, 26)) {
      throw new Error(
        makeFileError(
          DISABLED_SEATS_FILE,
          index + 1,
          `좌석 형식(${rowText}x${colText})이 올바르지 않습니다. (자연수여야함, 앞자리 0 금지)`,
        ),
      );
    }
    if (!validatePositiveIntegerInRange(colText, 99)) {
      throw new Error(
        makeFileError(
          DISABLED_SEATS_FILE,
          index + 1,
          `좌석 정보(${rowText}x${colText})가 올바르지 않습니다.`,
        ),
      );
    }
    if (Number(rowText) > theater.rows) {
      throw new Error(
        makeFileError(
          DISABLED_SEATS_FILE,
          index + 1,
          `좌석 범위(${rowText}x${colText})가 올바르지 않습니다. (행:1~26, 열:1~99)`,
        ),
      );
    }
    if (Number(colText) > theater.cols) {
      throw new Error(
        makeFileError(
          DISABLED_SEATS_FILE,
          index + 1,
          `좌석 범위(${rowText}x${colText})가 올바르지 않습니다. (행:1~26, 열:1~99)`,
        ),
      );
    }
    if (!validateDateSyntax(startDate)) {
      throw new Error(
        makeFileError(
          DISABLED_SEATS_FILE,
          index + 1,
          `시작 날짜(${startDate}) 형식이 올바르지 않습니다. 예: 2026-03-25`,
        ),
      );
    }
    if (!validateDateSemantic(startDate)) {
      throw new Error(
        makeFileError(
          DISABLED_SEATS_FILE,
          index + 1,
          `시작 날짜(${startDate})가 올바르지 않습니다.`,
        ),
      );
    }
    if (!validateDateSyntax(endDate)) {
      throw new Error(
        makeFileError(
          DISABLED_SEATS_FILE,
          index + 1,
          `종료 날짜(${endDate}) 형식이 올바르지 않습니다. 예: 2026-03-25`,
        ),
      );
    }
    if (!validateDateSemantic(endDate)) {
      throw new Error(
        makeFileError(
          DISABLED_SEATS_FILE,
          index + 1,
          `종료 날짜(${endDate})가 올바르지 않습니다.`,
        ),
      );
    }
    if (
      makeLocalDateTime(endDate, "00:00") <
      makeLocalDateTime(startDate, "00:00")
    ) {
      throw new Error(
        makeFileError(
          DISABLED_SEATS_FILE,
          index + 1,
          "사용금지 종료날짜는 시작날짜보다 이전일 수 없습니다.",
        ),
      );
    }
    ids.add(id);
    return {
      id,
      theaterId,
      row: Number(rowText),
      col: Number(colText),
      startDate,
      endDate,
    };
  });
  for (let i = 0; i < disabledSeats.length; i += 1) {
    for (let j = i + 1; j < disabledSeats.length; j += 1) {
      const a = disabledSeats[i];
      const b = disabledSeats[j];
      if (
        a.theaterId === b.theaterId &&
        a.row === b.row &&
        a.col === b.col &&
        isTimeOverlap(getDisabledSeatDateRange(a), getDisabledSeatDateRange(b))
      ) {
        throw new Error(
          makeFileError(
            DISABLED_SEATS_FILE,
            j + 1,
            "같은 좌석의 사용금지 기간이 겹칩니다.",
          ),
        );
      }
    }
  }
  return disabledSeats;
}

// 예매 파일 레코드 파싱 및 검증
function parseReservationsRawLines(lines, screenings, theaters, disabledSeats) {
  if (lines.length === 0) return [];

  const ids = new Set();
  const reservations = [];
  const stateForDisabledCheck = { disabledSeats };
  lines.forEach((line, index) => {
    const fields = line.split("|");
    if (fields.length !== 4)
      throw new Error(
        makeFileError(
          RESERVATIONS_FILE,
          index + 1,
          "데이터 형식이 올바르지 않습니다. (reservationId|phone|screeningId|seat).",
        ),
      );
    const [id, phone, screeningId, seatText] = fields;
    const seat = parseSeatInput(seatText);
    if (!validateReservationCodeSyntax(id))
      throw new Error(
        makeFileError(
          RESERVATIONS_FILE,
          index + 1,
          `reservationId(${id}) 형식이 올바르지 않습니다. 예: R001`,
        ),
      );
    if (ids.has(id))
      throw new Error(
        makeFileError(
          RESERVATIONS_FILE,
          index + 1,
          `중복된 reservationId(${id})가 있습니다.`,
        ),
      );
    if (!/^[0-9]+$/.test(phone) || !validatePhoneSyntax(phone))
      throw new Error(
        makeFileError(
          RESERVATIONS_FILE,
          index + 1,
          `전화번호(${phone}) 형식이 올바르지 않습니다.`,
        ),
      );
    if (!validateScreeningCodeSyntax(screeningId))
      throw new Error(
        makeFileError(
          RESERVATIONS_FILE,
          index + 1,
          `screeningId(${screeningId}) 형식이 올바르지 않습니다. 예: S001`,
        ),
      );
    const screening = getScreeningById(screeningId, screenings);
    if (!screening)
      throw new Error(
        makeFileError(
          RESERVATIONS_FILE,
          index + 1,
          `존재하지 않는 screeningId(${screeningId}) 참조`,
        ),
      );
    if (!seat)
      throw new Error(
        makeFileError(
          RESERVATIONS_FILE,
          index + 1,
          `좌석(${seatText}) 형식이 올바르지 않습니다. 예: A1, B3, C10`,
        ),
      );
    const theater = getTheaterById(screening.theaterId, theaters);
    if (!validateSeatSemantic(theater, seat))
      throw new Error(
        makeFileError(
          RESERVATIONS_FILE,
          index + 1,
          `존재하지 않는 좌석(${seatText})입니다. 선택 가능한 범위: A1 ~ ${rowNumberToChar(theater.rows)}${theater.cols}`,
        ),
      );
    if (isSeatReserved(screeningId, seat, reservations))
      throw new Error(
        makeFileError(
          RESERVATIONS_FILE,
          index + 1,
          "이미 예매된 좌석이 중복 저장되어 있습니다.",
        ),
      );
    if (isSeatDisabled(screening, seat, stateForDisabledCheck))
      throw new Error(
        makeFileError(
          RESERVATIONS_FILE,
          index + 1,
          "사용금지 좌석과 시간이 겹치는 좌석이 예매되어 있습니다.",
        ),
      );
    if (hasTimeConflict(phone, screening, reservations, screenings))
      throw new Error(
        makeFileError(
          RESERVATIONS_FILE,
          index + 1,
          "동일 전화번호로 시간이 겹치는 상영이 중복 예매되어 있습니다.",
        ),
      );
    ids.add(id);
    reservations.push({
      id,
      phone,
      screeningId,
      seatRow: seat.row,
      seatCol: seat.col,
    });
  });
  return reservations;
}

// 모든 데이터 파일 읽기 및 상태 검증
function parseAndValidateFiles() {
  const movies = parseMoviesRawLines(readRawLines(MOVIES_FILE));
  const theaters = parseTheatersRawLines(readRawLines(THEATERS_FILE));
  const screenings = parseScreeningsRawLines(
    readRawLines(SCREENINGS_FILE),
    movies,
    theaters,
  );
  const disabledSeats = parseDisabledSeatsRawLines(
    readRawLines(DISABLED_SEATS_FILE),
    theaters,
  );
  const reservations = parseReservationsRawLines(
    readRawLines(RESERVATIONS_FILE),
    screenings,
    theaters,
    disabledSeats,
  );
  return {
    movies,
    screenings,
    theaters,
    disabledSeats,
    reservations,
    currentDateTime: null,
  };
}

// 영화 레코드를 영화 파일에 저장
function saveMovies(state) {
  writeLines(
    MOVIES_FILE,
    state.movies.map(
      (movie) => `${movie.id}|${movie.title.trim()}|${movie.runningTime}`,
    ),
  );
}

// 상영관 레코드를 상영관 파일에 저장
function saveTheaters(state) {
  writeLines(
    THEATERS_FILE,
    state.theaters.map(
      (theater) => `${theater.id}|${theater.rows}|${theater.cols}`,
    ),
  );
}

// 상영 정보 레코드를 상영 정보 파일에 저장
function saveScreenings(state) {
  writeLines(
    SCREENINGS_FILE,
    state.screenings.map(
      (screening) =>
        `${screening.id}|${screening.movieId}|${screening.theaterId}|${screening.date}|${screening.time}`,
    ),
  );
}

// 사용 금지 좌석 레코드를 파일에 저장
function saveDisabledSeats(state) {
  writeLines(
    DISABLED_SEATS_FILE,
    state.disabledSeats.map(
      (seat) =>
        `${seat.id}|${seat.theaterId}|${seat.row}|${seat.col}|${seat.startDate}|${seat.endDate}`,
    ),
  );
}

// 예매 레코드를 예매 파일에 저장
function saveReservations(state) {
  writeLines(
    RESERVATIONS_FILE,
    state.reservations.map(
      (reservation) =>
        `${reservation.id}|${reservation.phone}|${reservation.screeningId}|${reservation.seatRow}${reservation.seatCol}`,
    ),
  );
}

// 사용 가능한 다음 접두어 ID 생성
function generateNextId(prefix, usedIds, maxNumber) {
  const used = new Set(usedIds);
  for (let index = 0; index <= maxNumber; index += 1) {
    const candidate = `${prefix}${String(index).padStart(3, "0")}`;
    if (!used.has(candidate)) return candidate;
  }
  return null;
}

// 사용 가능한 다음 상영관 ID 생성
function generateNextTheaterId(theaters) {
  for (let index = 1; index <= 9; index += 1) {
    const candidate = `T${index}`;
    if (!theaters.some((theater) => theater.id === candidate)) return candidate;
  }
  return null;
}

// 전화번호 기준 겹치는 상영 예매 여부 확인
function hasTimeConflict(phone, selectedScreening, reservations, screenings) {
  const selectedRange = getAbsoluteRange(selectedScreening);
  return reservations.some((reservation) => {
    if (
      !samePhone(reservation.phone, phone) ||
      reservation.screeningId === selectedScreening.id
    )
      return false;
    const screening = getScreeningById(reservation.screeningId, screenings);
    return Boolean(
      screening && isTimeOverlap(selectedRange, getAbsoluteRange(screening)),
    );
  });
}

// 선택 가능한 영화 목록 출력
function printMovies(movies) {
  console.log("\n[영화 목록]");
  movies.forEach((movie, index) =>
    console.log(
      `${index + 1}. ${movie.title} (${movie.id}, ${movie.runningTime}분)`,
    ),
  );
}

// 선택 가능한 상영관 목록 출력
function printTheaters(theaters) {
  console.log("\n[상영관 목록]");
  theaters.forEach((theater) =>
    console.log(`${theater.id} | ${theater.rows}행 ${theater.cols}열`),
  );
}

// 영화와 상영관 정보를 포함한 상영 목록 출력
function printScreenings(screenings, state) {
  console.log("\n[상영 정보]");
  screenings.forEach((screening, index) => {
    const theater = getTheaterById(screening.theaterId, state.theaters);
    console.log(
      `${index + 1}. ${screening.id} | ${getMovieTitle(screening.movieId, state.movies)} | ${getTheaterDisplayNumber(screening.theaterId)}관 | ${screening.date} | ${screening.time} | 총 ${theater.rows * theater.cols}석`,
    );
  });
}

// 상영의 좌석 배치도 출력
function displaySeats(screening, state) {
  const theater = getTheaterById(screening.theaterId, state.theaters);
  console.log("\n[좌석 배치도]");
  process.stdout.write("    ");
  for (let col = 1; col <= theater.cols; col += 1)
    process.stdout.write(`${String(col).padStart(2, " ")} `);
  console.log();
  for (let row = 1; row <= theater.rows; row += 1) {
    const rowChar = rowNumberToChar(row);
    process.stdout.write(`${rowChar} | `);
    for (let col = 1; col <= theater.cols; col += 1) {
      const seat = { row: rowChar, col };
      const unavailable =
        isSeatReserved(screening.id, seat, state.reservations) ||
        isSeatDisabled(screening, seat, state);
      process.stdout.write(`${unavailable ? "X" : "O"}  `);
    }
    console.log();
  }
  console.log("O: 예약 가능, X: 선택 불가");
}

// 유효한 날짜 입력까지 반복 질문
async function askValidDate(question) {
  while (true) {
    const input = await askInput(question);
    if (isControl(input)) return input;
    if (!validateFlexibleDateSyntax(input)) {
      console.log(
        "날짜 형식이 올바르지 않습니다. 숫자 8개와 '-'만 입력하세요.",
      );
      continue;
    }
    const date = normalizeDateInput(input);
    if (!validateDateSemantic(date)) {
      console.log("존재하지 않는 날짜입니다.");
      continue;
    }
    return date;
  }
}

// 유효한 시작 시간 입력까지 반복 질문
async function askValidStartTime(question) {
  while (true) {
    const input = await askInput(question);
    if (isControl(input)) return input;
    if (!validateStartTimeSyntax(input)) {
      console.log("시간 형식이 올바르지 않습니다. HH:MM 형식으로 입력하세요.");
      continue;
    }
    return input;
  }
}

// 최초 현재 날짜 입력 전용: help/quit/back/main을 명령어로 처리하지 않음
async function askInitialDateOnly(question) {
  while (true) {
    const input = await askRaw(question, normalizeInput);

    if (!input) {
      console.log("빈 입력은 허용되지 않습니다. 올바른 날짜를 입력하세요.");
      continue;
    }

    if (!validateFlexibleDateSyntax(input)) {
      console.log(
        "날짜 형식이 올바르지 않습니다. 숫자 8개와 '-'만 입력하세요.",
      );
      continue;
    }

    const date = normalizeDateInput(input);

    if (!validateDateSemantic(date)) {
      console.log("존재하지 않는 날짜입니다.");
      continue;
    }

    return date;
  }
}

// 최초 현재 시간 입력 전용: help/quit/back/main을 명령어로 처리하지 않음
async function askInitialStartTimeOnly(question) {
  while (true) {
    const input = await askRaw(question, normalizeInput);

    if (!input) {
      console.log("빈 입력은 허용되지 않습니다. 올바른 시간을 입력하세요.");
      continue;
    }

    if (!validateStartTimeSyntax(input)) {
      console.log("시간 형식이 올바르지 않습니다. HH:MM 형식으로 입력하세요.");
      continue;
    }

    return input;
  }
}

// 범위 안의 양의 정수 입력까지 반복 질문
async function askPositiveIntegerInRange(question, max, errorMessage) {
  while (true) {
    const input = await askInput(question);
    if (isControl(input)) return input;

    if (validatePositiveIntegerInRange(input, max)) {
      return Number(input);
    }

    console.log(errorMessage);
  }
}

// 초기 현재 날짜와 시간 입력 수신
async function inputInitialCurrentDateTime(state) {
  const date = await askInitialDateOnly("현재 날짜를 입력하세요: ");
  const time = await askInitialStartTimeOnly(
    "현재 시간을 입력하세요 (HH:MM): ",
  );

  state.currentDateTime = makeLocalDateTime(date, time);
}

// 예매할 영화 선택 단계 진행
async function selectMovieStep(state) {
  const movies = state.movies.filter((movie) =>
    state.screenings.some(
      (screening) =>
        screening.movieId === movie.id && isScreeningBookable(screening, state),
    ),
  );
  if (movies.length === 0) {
    console.log("현재 예매 가능한 영화가 없습니다.");
    return CTRL.BACK;
  }
  printMovies(movies);
  while (true) {
    const input = await askInput("영화 번호를 선택하세요: ");
    if (isControl(input)) return input;
    const index = Number(input);
    if (!Number.isInteger(index) || index < 1 || index > movies.length) {
      console.log("올바른 영화 번호를 입력하세요.");
      continue;
    }
    return movies[index - 1];
  }
}

// 선택한 영화의 상영 날짜 선택 단계 진행
async function selectDateStep(movieScreenings, state) {
  const dates = [
    ...new Set(
      movieScreenings
        .filter((screening) => isScreeningBookable(screening, state))
        .map((screening) => screening.date),
    ),
  ].sort();
  console.log("\n[상영 가능 날짜]");
  dates.forEach((date) => console.log(`- ${date}`));
  while (true) {
    const date = await askValidDate("상영 날짜를 입력하세요: ");
    if (isControl(date)) return date;
    if (!dates.includes(date)) {
      console.log("해당 날짜에는 선택한 영화의 상영 정보가 없습니다.");
      continue;
    }
    return date;
  }
}

// 가능한 상영 중 시간 선택 단계 진행
async function selectScreeningStep(screenings, state) {
  const bookable = screenings.filter((screening) =>
    isScreeningBookable(screening, state),
  );
  if (bookable.length === 0) {
    console.log("예매 가능한 상영 정보가 없습니다.");
    return CTRL.BACK;
  }
  printScreenings(bookable, state);
  while (true) {
    const input = await askInput("상영 번호를 선택하세요: ");
    if (isControl(input)) return input;
    const index = Number(input);
    if (!Number.isInteger(index) || index < 1 || index > bookable.length) {
      console.log("올바른 상영 번호를 선택하세요.");
      continue;
    }
    return bookable[index - 1];
  }
}

// 상영 예매용 전화번호 입력 수신
async function inputPhoneStep(state, screening) {
  while (true) {
    const input = await askInput("전화번호를 입력하세요: ");
    if (isControl(input)) return input;
    if (!validatePhoneSyntax(input)) {
      console.log("전화번호 형식이 올바르지 않습니다.");
      continue;
    }
    if (
      hasTimeConflict(input, screening, state.reservations, state.screenings)
    ) {
      console.log(
        "해당 전화번호로 같은 날짜/겹치는 시간대의 예매가 이미 있습니다.",
      );
      continue;
    }
    return normalizePhone(input);
  }
}

// 상영 좌석 선택 단계 진행
async function selectSeatStep(state, screening) {
  const theater = getTheaterById(screening.theaterId, state.theaters);
  while (true) {
    displaySeats(screening, state);
    const input = await askInput(
      `좌석을 입력하세요 (예: A1 ~ ${rowNumberToChar(theater.rows)}${theater.cols}): `,
    );
    if (isControl(input)) return input;
    const seat = parseSeatInput(input);
    if (!seat) {
      console.log(
        "좌석 행은 대문자만 입력 가능하며, 한 자리 좌석번호는 A01처럼 0을 붙일 수 없습니다.",
      );
      continue;
    }
    if (!validateSeatSemantic(theater, seat)) {
      console.log(
        `좌석 범위를 벗어났습니다. 선택 가능한 좌석은 A1 ~ ${rowNumberToChar(theater.rows)}${theater.cols} 입니다.`,
      );
      continue;
    }
    if (isSeatReserved(screening.id, seat, state.reservations)) {
      console.log("이미 예매된 좌석입니다. 다시 선택하세요.");
      continue;
    }
    if (isSeatDisabled(screening, seat, state)) {
      console.log("사용금지 좌석은 예매할 수 없습니다.");
      continue;
    }
    return seat;
  }
}

// 예매 정보 사용자 확인
async function confirmReservationStep(movie, screening, phone, seat) {
  console.log("\n[예매 확인]");
  console.log(`영화: ${movie.title}`);
  console.log(`상영관: ${getTheaterDisplayNumber(screening.theaterId)}관`);
  console.log(`날짜: ${screening.date}`);
  console.log(`시간: ${screening.time}`);
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

// 예매 레코드 생성 및 저장
function saveReservation(state, phone, screeningId, seat) {
  const id = generateNextId(
    "R",
    state.reservations.map((reservation) => reservation.id),
    999,
  );

  // 예매 코드를 생성할 수 없다면 오류 메시지 출력 후 프로그램 종료
  if (!id) {
    console.log("더 이상 예매코드를 생성할 수 없습니다.");
    safeExit();
  }

  state.reservations.push({
    id,
    phone,
    screeningId,
    seatRow: seat.row,
    seatCol: seat.col,
  });

  saveReservations(state);
  return true;
}

// 영화 예매 전체 흐름 실행
async function reserveMovieFlow(state) {
  let step = 1;
  let movie = null;
  let date = null;
  let screening = null;
  let phone = null;
  let seat = null;

  while (true) {
    if (step === 1) {
      const result = await selectMovieStep(state);
      if (isControl(result))
        return result.command === CMD.MAIN ? result : undefined;
      movie = result;
      step = 2;
    } else if (step === 2) {
      const result = await selectDateStep(
        state.screenings.filter((item) => item.movieId === movie.id),
        state,
      );
      if (isControl(result)) {
        if (result.command === CMD.MAIN) return result;
        step = 1;
      } else {
        date = result;
        step = 3;
      }
    } else if (step === 3) {
      const result = await selectScreeningStep(
        state.screenings.filter(
          (item) => item.movieId === movie.id && item.date === date,
        ),
        state,
      );
      if (isControl(result)) {
        if (result.command === CMD.MAIN) return result;
        step = 2;
      } else {
        screening = result;
        step = 4;
      }
    } else if (step === 4) {
      const result = await inputPhoneStep(state, screening);
      if (isControl(result)) {
        if (result.command === CMD.MAIN) return result;
        step = 3;
      } else {
        phone = result;
        step = 5;
      }
    } else if (step === 5) {
      const result = await selectSeatStep(state, screening);
      if (isControl(result)) {
        if (result.command === CMD.MAIN) return result;
        step = 4;
      } else {
        seat = result;
        step = 6;
      }
    } else {
      const result = await confirmReservationStep(
        movie,
        screening,
        phone,
        seat,
      );
      if (isControl(result)) {
        if (result.command === CMD.MAIN) return result;
        step = 5;
      } else if (!result) {
        console.log("예매를 진행하지 않았습니다.");
        step = 5;
      } else {
        saveReservation(state, phone, screening.id, seat);
        console.log("예매가 완료되었습니다.");
        return;
      }
    }
  }
}

// 조회된 예매의 취소 흐름 실행
async function cancelReservationFlow(state, reservations) {
  while (true) {
    const input = await askInput(
      "취소할 예매코드를 입력하세요 (취소하지 않으려면 back): ",
    );

    if (isControl(input)) return input;

    if (!validateReservationCodeSyntax(input)) {
      console.log("예매 코드 형식이 올바르지 않습니다.");
      continue;
    }

    const globalReservation = state.reservations.find(
      (item) => item.id === input,
    );

    if (!globalReservation) {
      console.log("해당 예매 코드를 찾을 수 없습니다.");
      continue;
    }

    const reservation = reservations.find((item) => item.id === input);

    if (!reservation) {
      console.log("현재 조회한 예매 내역에 존재하지 않는 예매 코드입니다.");
      continue;
    }

    const screening = getScreeningById(
      reservation.screeningId,
      state.screenings,
    );

    const remaining =
      getScreeningDateTimeRange(screening).start - state.currentDateTime;

    if (remaining <= 10 * 60 * 1000) {
      console.log("상영 시작 10분 전부터는 예매를 취소할 수 없습니다.");
      continue;
    }

    state.reservations = state.reservations.filter(
      (item) => item.id !== reservation.id,
    );

    saveReservations(state);
    console.log("예매가 정상적으로 취소되었습니다.");
    return;
  }
}

// 전화번호로 예매 내역 조회
async function lookupReservationFlow(state) {
  while (true) {
    const phone = await askInput("조회할 전화번호를 입력하세요: ");
    if (isControl(phone)) return phone;
    if (!validatePhoneSyntax(phone)) {
      console.log("전화번호 형식이 올바르지 않습니다.");
      continue;
    }
    const reservations = state.reservations.filter((reservation) =>
      samePhone(reservation.phone, phone),
    );
    if (reservations.length === 0) {
      console.log("해당 전화번호로 예매된 내역이 없습니다.");
      return;
    }
    console.log("\n[예매 내역 조회]");
    reservations.forEach((reservation) => {
      const screening = getScreeningById(
        reservation.screeningId,
        state.screenings,
      );
      console.log(
        `${reservation.id} | 영화: ${getMovieTitle(screening.movieId, state.movies)} | 상영관: ${getTheaterDisplayNumber(screening.theaterId)}관 | 날짜: ${screening.date} | 시간: ${screening.time} | 좌석: ${reservation.seatRow}${reservation.seatCol}`,
      );
    });
    return cancelReservationFlow(state, reservations);
  }
}

// 시뮬레이션용 현재 날짜와 시간 변경
async function changeCurrentDateTimeFlow(state) {
  let step = 1;
  let date = null;

  while (true) {
    if (step === 1) {
      const result = await askValidDate("새 현재 날짜를 입력하세요: ");
      if (isControl(result))
        return result.command === CMD.MAIN ? result : undefined;

      const currentDate = formatDate(state.currentDateTime);
      if (result < currentDate) {
        console.log("기존 현재 날짜보다 이전 날짜는 입력할 수 없습니다.");
        continue;
      }

      date = result;
      step = 2;
    } else {
      const time = await askValidStartTime(
        "새 현재 시간을 입력하세요 (HH:MM): ",
      );
      if (isControl(time)) {
        if (time.command === CMD.MAIN) return time;
        step = 1;
        continue;
      }

      const next = makeLocalDateTime(date, time);

      if (next <= state.currentDateTime) {
        console.log("현재 시간은 기존 현재 시간보다 미래여야 합니다.");
        step = 1;
        continue;
      }

      state.currentDateTime = next;
      console.log(
        `현재 시간이 ${formatDateTime(state.currentDateTime)}으로 변경되었습니다.`,
      );
      return;
    }
  }
}

// 존재하는 영화 코드 입력까지 반복 질문
async function askMovieCode(state, question) {
  while (true) {
    const input = await askInput(question);
    if (isControl(input)) return input;
    if (!validateMovieCodeSyntax(input)) {
      console.log("영화 코드 형식이 올바르지 않습니다.");
      continue;
    }
    const movie = getMovieById(input, state.movies);
    if (!movie) {
      console.log("해당 영화 정보를 찾을 수 없습니다.");
      continue;
    }
    return movie;
  }
}

// 존재하는 상영관 코드 입력까지 반복 질문
async function askTheater(state, question) {
  while (true) {
    const input = await askInput(question);
    if (isControl(input)) return input;
    if (!validateTheaterCodeSyntax(input)) {
      console.log("상영관 코드 형식이 올바르지 않습니다.");
      continue;
    }
    const theater = getTheaterById(input, state.theaters);
    if (!theater) {
      console.log("해당 상영관 정보를 찾을 수 없습니다.");
      continue;
    }
    return theater;
  }
}

// 유효한 상영 시간 입력까지 반복 질문
async function askRunningTime() {
  while (true) {
    const input = await askInput("러닝타임을 입력하세요 (분): ");
    if (isControl(input)) return input;
    if (!validateRunningTime(input)) {
      console.log("올바른 러닝타임을 입력하세요.");
      continue;
    }
    return Number(input);
  }
}

// 영화 추가 흐름 실행
async function addMovieFlow(state) {
  const id = generateNextId(
    "M",
    state.movies.map((movie) => movie.id),
    999,
  );
  if (!id) return console.log("더 이상 영화 정보를 추가할 수 없습니다.");
  let step = 1;
  let title = null;

  while (true) {
    if (step === 1) {
      const result = await askMovieTitle("영화 제목을 입력하세요: ");
      if (isControl(result))
        return result.command === CMD.MAIN ? result : undefined;
      if (!validateMovieTitleSyntax(result)) {
        console.log("올바른 영화 제목을 입력하세요.");
        continue;
      }
      title = result;
      step = 2;
    } else {
      const runningTime = await askRunningTime();
      if (isControl(runningTime)) {
        if (runningTime.command === CMD.MAIN) return runningTime;
        step = 1;
        continue;
      }
      state.movies.push({ id, title, runningTime });
      saveMovies(state);
      console.log("영화 정보가 추가되었습니다.");
      return;
    }
  }
}

// 영화 삭제 흐름 실행
async function deleteMovieFlow(state) {
  printMovies(state.movies);
  const movie = await askMovieCode(state, "삭제할 영화코드를 입력하세요: ");
  if (isControl(movie)) return movie;
  const relatedScreenings = state.screenings.filter(
    (screening) => screening.movieId === movie.id,
  );
  if (
    relatedScreenings.some(
      (screening) =>
        getScreeningDateTimeRange(screening).end <= state.currentDateTime,
    )
  ) {
    console.log(
      "해당 영화와 관련된 이미 종료된 상영 정보가 존재하여 삭제할 수 없습니다.",
    );
    return;
  }
  if (
    relatedScreenings.some((screening) => {
      const range = getScreeningDateTimeRange(screening);
      return (
        range.start <= state.currentDateTime &&
        state.currentDateTime < range.end
      );
    })
  ) {
    console.log(
      "해당 영화와 관련된 현재 상영 중인 상영 정보가 존재하여 삭제할 수 없습니다.",
    );
    return;
  }
  if (
    relatedScreenings.some((screening) =>
      state.reservations.some(
        (reservation) => reservation.screeningId === screening.id,
      ),
    )
  ) {
    console.log("해당 영화와 관련된 예매 내역이 존재하여 삭제할 수 없습니다.");
    return;
  }
  state.movies = state.movies.filter((item) => item.id !== movie.id);
  state.screenings = state.screenings.filter(
    (screening) => screening.movieId !== movie.id,
  );
  saveMovies(state);
  saveScreenings(state);
  console.log("영화 정보가 삭제되었습니다.");
}

// 상영관 시간표 충돌 여부 확인
function validateScreeningSchedule(candidate, state, excludedId = null) {
  return !state.screenings.some(
    (screening) =>
      screening.id !== excludedId &&
      screening.theaterId === candidate.theaterId &&
      isTimeOverlap(getAbsoluteRange(candidate), getAbsoluteRange(screening)),
  );
}

// 상영 변경 후 예매 유효성 확인
function validateReservationsForScreening(candidate, state) {
  const theater = getTheaterById(candidate.theaterId, state.theaters);
  const reservations = state.reservations.filter(
    (reservation) => reservation.screeningId === candidate.id,
  );
  return (
    reservations.every((reservation) => {
      const seat = { row: reservation.seatRow, col: reservation.seatCol };
      return (
        validateSeatSemantic(theater, seat) &&
        !isSeatDisabled(candidate, seat, state)
      );
    }) &&
    reservations.every(
      (reservation) =>
        !hasTimeConflict(
          reservation.phone,
          candidate,
          state.reservations.filter(
            (item) => item.screeningId !== candidate.id,
          ),
          state.screenings,
        ),
    )
  );
}

// 영화 상영 시간 수정 흐름 실행
async function updateMovieRunningTimeFlow(state) {
  let step = 1;
  let movie = null;

  while (true) {
    if (step === 1) {
      printMovies(state.movies);
      const result = await askMovieCode(
        state,
        "수정할 영화코드를 입력하세요: ",
      );
      if (isControl(result))
        return result.command === CMD.MAIN ? result : undefined;

      const relatedScreenings = state.screenings.filter(
        (screening) => screening.movieId === result.id,
      );
      if (
        relatedScreenings.some(
          (screening) =>
            getScreeningDateTimeRange(screening).end <= state.currentDateTime,
        )
      ) {
        console.log(
          "해당 영화와 관련된 이미 종료된 상영 정보가 존재하여 수정할 수 없습니다.",
        );
        return;
      }
      if (
        relatedScreenings.some((screening) => {
          const range = getScreeningDateTimeRange(screening);
          return (
            range.start <= state.currentDateTime &&
            state.currentDateTime < range.end
          );
        })
      ) {
        console.log(
          "해당 영화와 관련된 현재 상영 중인 상영 정보가 존재하여 수정할 수 없습니다.",
        );
        return;
      }
      if (
        relatedScreenings.some((screening) =>
          state.reservations.some(
            (reservation) => reservation.screeningId === screening.id,
          ),
        )
      ) {
        console.log(
          "해당 영화와 관련된 예매 내역이 존재하여 수정할 수 없습니다.",
        );
        return;
      }

      movie = result;
      step = 2;
    } else {
      const runningTime = await askRunningTime();
      if (isControl(runningTime)) {
        if (runningTime.command === CMD.MAIN) return runningTime;
        step = 1;
        continue;
      }

      const changed = state.screenings.map((screening) =>
        screening.movieId === movie.id
          ? {
              ...screening,
              time: formatTimeRangeFromStartAndRunningTime(
                screening.time.split(" - ")[0],
                runningTime,
                screening.date,
              ),
            }
          : screening,
      );
      const temporaryState = { ...state, screenings: changed };
      for (const screening of changed) {
        if (
          !validateScreeningSchedule(screening, temporaryState, screening.id) ||
          !validateReservationsForScreening(screening, temporaryState)
        ) {
          console.log(
            "변경된 러닝타임이 기존 데이터와 충돌하여 수정할 수 없습니다.",
          );
          return;
        }
      }
      movie.runningTime = runningTime;
      state.screenings = changed;
      saveMovies(state);
      saveScreenings(state);
      console.log("영화 정보가 수정되었습니다.");
      return;
    }
  }
}

// 영화 관리 메뉴 반복 흐름 실행
async function movieManageMenuFlow(state) {
  while (true) {
    console.log(
      "\n[영화 정보 관리]\n1. 영화 정보 추가\n2. 영화 정보 삭제\n3. 영화 러닝타임 수정",
    );
    const choice = await askInput("메뉴 번호를 입력하세요: ");
    if (isControl(choice))
      return choice.command === CMD.MAIN ? choice : undefined;
    let result;
    if (choice === "1") result = await addMovieFlow(state);
    else if (choice === "2") result = await deleteMovieFlow(state);
    else if (choice === "3") result = await updateMovieRunningTimeFlow(state);
    else console.log("올바른 메뉴 번호를 입력하세요.");
    if (isControl(result) && result.command === CMD.MAIN) return result;
  }
}

// 상영 추가 또는 수정을 위한 입력 수집 및 검증
async function buildScreeningInput(state, id, mode = "add") {
  let step = 1;
  let movie = null;
  let theater = null;
  let date = null;

  while (true) {
    if (step === 1) {
      printMovies(state.movies);
      const result = await askMovieCode(state, "영화코드를 입력하세요: ");
      if (isControl(result))
        return result.command === CMD.MAIN ? result : undefined;
      movie = result;
      step = 2;
    } else if (step === 2) {
      printTheaters(state.theaters);
      const result = await askTheater(state, "상영관코드를 입력하세요: ");
      if (isControl(result)) {
        if (result.command === CMD.MAIN) return result;
        step = 1;
        continue;
      }
      theater = result;
      step = 3;
    } else if (step === 3) {
      const result = await askValidDate("상영 날짜를 입력하세요: ");
      if (isControl(result)) {
        if (result.command === CMD.MAIN) return result;
        step = 2;
        continue;
      }
      date = result;
      step = 4;
    } else {
      const startTime = await askValidStartTime(
        "상영 시작시간을 입력하세요 (HH:MM): ",
      );
      if (isControl(startTime)) {
        if (startTime.command === CMD.MAIN) return startTime;
        step = 3;
        continue;
      }

      const screening = {
        id,
        movieId: movie.id,
        theaterId: theater.id,
        date,
        time: formatTimeRangeFromStartAndRunningTime(
          startTime,
          movie.runningTime,
          date,
        ),
      };

      const pastOrSameMessage =
        mode === "update"
          ? "현재 시간보다 이전 또는 같은 시각의 상영 정보로 수정할 수 없습니다."
          : "현재 시간보다 이전 또는 같은 시각의 상영 정보는 추가할 수 없습니다.";

      if (getScreeningDateTimeRange(screening).start <= state.currentDateTime) {
        console.log(pastOrSameMessage);
        step = 3;
        continue;
      }

      if (!validateScreeningSchedule(screening, state, id)) {
        console.log("해당 상영관에 시간이 겹치는 상영 정보가 존재합니다.");
        continue;
      }

      return screening;
    }
  }
}

// 상영 정보 추가 흐름 실행
async function addScreeningFlow(state) {
  const id = generateNextId(
    "S",
    state.screenings.map((screening) => screening.id),
    999,
  );
  if (!id) return console.log("더 이상 상영 정보를 추가할 수 없습니다.");
  const screening = await buildScreeningInput(state, id, "add");
  if (isControl(screening)) return screening;
  if (!screening) return;
  state.screenings.push(screening);
  saveScreenings(state);
  console.log("상영 정보가 추가되었습니다.");
}

// 존재하는 상영 코드 입력까지 반복 질문
async function askScreening(state, question) {
  while (true) {
    const input = await askInput(question);
    if (isControl(input)) return input;
    if (!validateScreeningCodeSyntax(input)) {
      console.log("상영 코드 형식이 올바르지 않습니다.");
      continue;
    }
    const screening = getScreeningById(input, state.screenings);
    if (!screening) {
      console.log("해당 상영 정보를 찾을 수 없습니다.");
      continue;
    }
    return screening;
  }
}

// 상영 정보 삭제 흐름 실행
async function deleteScreeningFlow(state) {
  printScreenings(state.screenings, state);
  const screening = await askScreening(state, "삭제할 상영코드를 입력하세요: ");
  if (isControl(screening)) return screening;
  if (isScreeningEnded(screening, state))
    return console.log("이미 종료된 상영 정보는 삭제할 수 없습니다.");
  if (isScreeningNowPlaying(screening, state))
    return console.log("현재 상영 중인 상영 정보는 삭제할 수 없습니다.");
  if (
    state.reservations.some(
      (reservation) => reservation.screeningId === screening.id,
    )
  )
    return console.log(
      "해당 상영 정보와 관련된 예매 내역이 존재하여 삭제할 수 없습니다.",
    );
  state.screenings = state.screenings.filter(
    (item) => item.id !== screening.id,
  );
  saveScreenings(state);
  console.log("상영 정보가 삭제되었습니다.");
}

// 상영 정보 수정 흐름 실행
async function updateScreeningFlow(state) {
  printScreenings(state.screenings, state);
  const original = await askScreening(state, "수정할 상영코드를 입력하세요: ");
  if (isControl(original)) return original;
  if (isScreeningEnded(original, state))
    return console.log("이미 종료된 상영 정보는 수정할 수 없습니다.");
  if (isScreeningNowPlaying(original, state))
    return console.log("현재 상영 중인 상영 정보는 수정할 수 없습니다.");
  if (
    state.reservations.some(
      (reservation) => reservation.screeningId === original.id,
    )
  ) {
    console.log(
      "해당 상영 정보와 관련된 예매 내역이 존재하여 수정할 수 없습니다.",
    );
    return;
  }
  const screening = await buildScreeningInput(state, original.id, "update");
  if (isControl(screening)) return screening;
  if (!screening) return;
  if (!validateReservationsForScreening(screening, state))
    return console.log("수정 후 기존 예매 내역과 충돌하여 수정할 수 없습니다.");
  state.screenings = state.screenings.map((item) =>
    item.id === original.id ? screening : item,
  );
  saveScreenings(state);
  console.log("상영 정보가 수정되었습니다.");
}

// 상영 정보 관리 메뉴 반복 흐름 실행
async function screeningManageMenuFlow(state) {
  while (true) {
    console.log(
      "\n[상영 정보 관리]\n1. 상영 정보 추가\n2. 상영 정보 삭제\n3. 상영 정보 수정",
    );
    const choice = await askInput("메뉴 번호를 입력하세요: ");
    if (isControl(choice))
      return choice.command === CMD.MAIN ? choice : undefined;
    let result;
    if (choice === "1") result = await addScreeningFlow(state);
    else if (choice === "2") result = await deleteScreeningFlow(state);
    else if (choice === "3") result = await updateScreeningFlow(state);
    else console.log("올바른 메뉴 번호를 입력하세요.");
    if (isControl(result) && result.command === CMD.MAIN) return result;
  }
}

// 상영관 추가 흐름 실행
async function addTheaterFlow(state) {
  const id = generateNextTheaterId(state.theaters);
  if (!id) return console.log("더 이상 상영관 정보를 추가할 수 없습니다.");
  let step = 1;
  let rows = null;

  while (true) {
    if (step === 1) {
      const result = await askInput("행 수를 입력하세요: ");
      if (isControl(result))
        return result.command === CMD.MAIN ? result : undefined;
      if (!validatePositiveIntegerInRange(result, 26)) {
        console.log("행 수 입력 형식이 올바르지 않습니다.");
        continue;
      }
      rows = Number(result);
      step = 2;
    } else {
      const cols = await askInput("열 수를 입력하세요: ");
      if (isControl(cols)) {
        if (cols.command === CMD.MAIN) return cols;
        step = 1;
        continue;
      }
      if (!validatePositiveIntegerInRange(cols, 99)) {
        console.log("열 수 입력 형식이 올바르지 않습니다.");
        continue;
      }
      state.theaters.push({ id, rows, cols: Number(cols) });
      saveTheaters(state);
      console.log("상영관 정보가 추가되었습니다.");
      return;
    }
  }
}

// 상영관 삭제 흐름 실행
async function deleteTheaterFlow(state) {
  printTheaters(state.theaters);
  const theater = await askTheater(state, "삭제할 상영관코드를 입력하세요: ");
  if (isControl(theater)) return theater;
  const screenings = state.screenings.filter(
    (screening) => screening.theaterId === theater.id,
  );

  if (screenings.some((screening) => isScreeningEnded(screening, state))) {
    return console.log(
      "이미 종료된 상영 정보와 관련된 상영관은 삭제할 수 없습니다.",
    );
  }

  if (screenings.some((screening) => isScreeningNowPlaying(screening, state))) {
    return console.log(
      "현재 상영 중인 상영 정보와 관련된 상영관은 삭제할 수 없습니다.",
    );
  }

  if (
    screenings.some((screening) =>
      state.reservations.some(
        (reservation) => reservation.screeningId === screening.id,
      ),
    )
  )
    return console.log(
      "해당 상영관 정보와 관련된 예매 내역이 존재하여 삭제할 수 없습니다.",
    );
  state.theaters = state.theaters.filter((item) => item.id !== theater.id);
  state.screenings = state.screenings.filter(
    (screening) => screening.theaterId !== theater.id,
  );
  state.disabledSeats = state.disabledSeats.filter(
    (seat) => seat.theaterId !== theater.id,
  );
  saveTheaters(state);
  saveScreenings(state);
  saveDisabledSeats(state);
  console.log("상영관 정보가 삭제되었습니다.");
}

// 사용 금지 좌석 추가 흐름 실행
async function addDisabledSeatFlow(state) {
  const id = generateNextId(
    "D",
    state.disabledSeats.map((seat) => seat.id),
    999,
  );

  if (!id) {
    return console.log("더 이상 사용금지 좌석 정보를 추가할 수 없습니다.");
  }

  printTheaters(state.theaters);

  let step = 1;
  let theater = null;
  let row = null;
  let col = null;
  let startDate = null;
  let endDate = null;
  const currentDate = formatDate(state.currentDateTime);

  while (true) {
    if (step === 1) {
      const result = await askTheater(state, "상영관코드를 입력하세요: ");
      if (isControl(result))
        return result.command === CMD.MAIN ? result : undefined;
      theater = result;
      step = 2;
    } else if (step === 2) {
      const result = await askPositiveIntegerInRange(
        "사용금지 좌석 행 번호를 입력하세요: ",
        theater.rows,
        "좌석 행 번호 형식 또는 범위가 올바르지 않습니다.",
      );
      if (isControl(result)) {
        if (result.command === CMD.MAIN) return result;
        step = 1;
        continue;
      }
      row = result;
      step = 3;
    } else if (step === 3) {
      const result = await askPositiveIntegerInRange(
        "사용금지 좌석 열 번호를 입력하세요: ",
        theater.cols,
        "좌석 열 번호 형식 또는 범위가 올바르지 않습니다.",
      );
      if (isControl(result)) {
        if (result.command === CMD.MAIN) return result;
        step = 2;
        continue;
      }
      col = result;
      step = 4;
    } else if (step === 4) {
      const result = await askValidDate("사용금지 시작 날짜를 입력하세요: ");
      if (isControl(result)) {
        if (result.command === CMD.MAIN) return result;
        step = 3;
        continue;
      }
      if (result <= currentDate) {
        console.log("현재 날짜보다 이후의 날짜만 입력할 수 있습니다.");
        continue;
      }
      startDate = result;
      step = 5;
    } else {
      const result = await askValidDate("사용금지 종료 날짜를 입력하세요: ");
      if (isControl(result)) {
        if (result.command === CMD.MAIN) return result;
        step = 4;
        continue;
      }
      if (result <= currentDate) {
        console.log("현재 날짜보다 이후의 날짜만 입력할 수 있습니다.");
        continue;
      }
      if (result < startDate) {
        console.log("사용금지 종료날짜는 시작날짜보다 이전일 수 없습니다.");
        continue;
      }
      endDate = result;
      break;
    }
  }

  const disabledSeat = {
    id,
    theaterId: theater.id,
    row,
    col,
    startDate,
    endDate,
  };

  const disabledRange = getDisabledSeatDateRange(disabledSeat);

  const overlappingDisabledSeats = state.disabledSeats
    .filter(
      (item) =>
        item.theaterId === disabledSeat.theaterId &&
        item.row === disabledSeat.row &&
        item.col === disabledSeat.col &&
        isTimeOverlap(disabledRange, getDisabledSeatDateRange(item)),
    )
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  if (overlappingDisabledSeats.length > 0) {
    const overlap = overlappingDisabledSeats[0];
    return console.log(
      `해당 기간에 이미 사용금지로 설정된 좌석입니다. (${overlap.startDate} ~ ${overlap.endDate})`,
    );
  }

  const conflictingReservations = state.reservations
    .map((reservation) => ({
      reservation,
      screening: getScreeningById(reservation.screeningId, state.screenings),
    }))
    .filter(({ reservation, screening }) => {
      if (!screening) return false;

      return (
        screening.theaterId === theater.id &&
        rowCharToNumber(reservation.seatRow) === row &&
        reservation.seatCol === col &&
        isTimeOverlap(getAbsoluteRange(screening), disabledRange)
      );
    })
    .sort(
      (a, b) =>
        getScreeningDateTimeRange(a.screening).start -
        getScreeningDateTimeRange(b.screening).start,
    );

  if (conflictingReservations.length > 0) {
    const { screening } = conflictingReservations[0];
    return console.log(
      `${screening.date}에 해당 좌석의 예매 내역이 존재하여 사용금지 설정을 할 수 없습니다.`,
    );
  }

  state.disabledSeats.push(disabledSeat);
  saveDisabledSeats(state);

  console.log("좌석 사용금지 정보가 추가되었습니다.");
}

// 상영관 관리 메뉴 반복 흐름 실행
async function theaterManageMenuFlow(state) {
  while (true) {
    console.log(
      "\n[상영관 정보 관리]\n1. 상영관 정보 추가\n2. 상영관 정보 삭제\n3. 좌석 사용금지 설정",
    );
    const choice = await askInput("메뉴 번호를 입력하세요: ");
    if (isControl(choice))
      return choice.command === CMD.MAIN ? choice : undefined;
    let result;
    if (choice === "1") result = await addTheaterFlow(state);
    else if (choice === "2") result = await deleteTheaterFlow(state);
    else if (choice === "3") result = await addDisabledSeatFlow(state);
    else console.log("올바른 메뉴 번호를 입력하세요.");
    if (isControl(result) && result.command === CMD.MAIN) return result;
  }
}

// 관리자 메뉴 반복 흐름 실행
async function adminMenuFlow(state) {
  while (true) {
    console.log(
      "\n[관리자 메뉴]\n1. 영화 정보 관리\n2. 상영 정보 관리\n3. 상영관 정보 관리",
    );
    const choice = await askInput("메뉴 번호를 입력하세요: ");
    if (isControl(choice)) return choice;
    let result;
    if (choice === "1") result = await movieManageMenuFlow(state);
    else if (choice === "2") result = await screeningManageMenuFlow(state);
    else if (choice === "3") result = await theaterManageMenuFlow(state);
    else console.log("올바른 메뉴 번호를 입력하세요.");
    if (isControl(result) && result.command === CMD.MAIN) return result;
  }
}

// 관리자 비밀번호 확인 후 관리자 메뉴 열기
async function authenticateAdminFlow(state) {
  while (true) {
    const password = await askInput("관리자 비밀번호를 입력하세요: ");
    if (isControl(password))
      return password.command === CMD.MAIN ? password : undefined;
    if (password === ADMIN_PASSWORD) {
      const result = await adminMenuFlow(state);
      if (isControl(result) && result.command === CMD.MAIN) return result;
      continue;
    }
    console.log("올바른 비밀번호를 입력하세요.");
  }
}

// 메인 메뉴와 현재 시뮬레이션 시간 출력
function printMainMenu(state) {
  console.log("\n==============================");
  console.log("영화 예매 시스템");
  console.log(`현재 시간: ${formatDateTime(state.currentDateTime)}`);
  console.log("==============================");
  console.log("1. 영화 예매");
  console.log("2. 예매 내역 조회");
  console.log("3. 현재 시간 변경");
  console.log("4. 관리자 기능");
  console.log("5. 종료");
  console.log("==============================");
}

// 시작 전 필수 데이터 파일 존재 여부 확인
function checkRequiredFiles() {
  for (const [fileName, message] of [
    [MOVIES_FILE, "영화 정보 파일이 존재하지 않습니다."],
    [SCREENINGS_FILE, "상영 정보 파일이 존재하지 않습니다."],
    [THEATERS_FILE, "상영관 정보 파일이 존재하지 않습니다."],
  ]) {
    if (!fs.existsSync(fileName)) {
      console.log(message);
      rl.close();
      process.exit(1);
    }
  }
  for (const fileName of [RESERVATIONS_FILE, DISABLED_SEATS_FILE]) {
    if (!fs.existsSync(fileName)) fs.writeFileSync(fileName, "", "utf8");
  }
}

// 예매 시스템 시작 및 메인 메뉴 반복 흐름 실행
async function main() {
  checkRequiredFiles();
  let state;
  try {
    state = parseAndValidateFiles();
  } catch (error) {
    console.error(error.message);
    rl.close();
    return;
  }
  await inputInitialCurrentDateTime(state);
  while (true) {
    printMainMenu(state);
    const choice = await askInput("메뉴 번호를 입력하세요: ", {
      allowBack: false,
      allowMain: false,
    });
    if (choice === "1") await reserveMovieFlow(state);
    else if (choice === "2") await lookupReservationFlow(state);
    else if (choice === "3") await changeCurrentDateTimeFlow(state);
    else if (choice === "4") await authenticateAdminFlow(state);
    else if (choice === "5") return safeExit();
    else console.log("올바른 메뉴 번호를 입력하세요.");
  }
}

main();
