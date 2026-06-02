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

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function readRawLines(fileName) {
  const content = fs.readFileSync(fileName, "utf8");
  if (!content.trim()) return [];
  return content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function writeLines(fileName, lines) {
  fs.writeFileSync(fileName, lines.join("\n"), "utf8");
}

function printHelp() {
  console.log("\n[도움말]");
  console.log("help : 도움말 보기");
  console.log("quit : 프로그램 종료");
  console.log("back : 이전 단계로 이동");
  console.log("main : 메인 메뉴로 이동");
}

function safeExit() {
  console.log("프로그램을 종료합니다.");
  rl.close();
  process.exit(0);
}

function normalizeInput(input) {
  return input.replace(/\s+/g, "");
}

function normalizeMovieTitleInput(input) {
  return input.trim();
}

function askRaw(question, normalizer = normalizeInput) {
  return new Promise((resolve) => rl.question(question, (answer) => resolve(normalizer(answer))));
}

async function askWithNormalizer(question, options = {}, normalizer = normalizeInput) {
  const { allowBack = true, allowMain = true } = options;
  while (true) {
    const input = await askRaw(question, normalizer);
    if (!input) {
      console.log("빈 입력은 허용되지 않습니다. back/main/help/quit 또는 올바른 값을 입력하세요.");
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

function askInput(question, options = {}) {
  return askWithNormalizer(question, options);
}

function askMovieTitle(question, options = {}) {
  return askWithNormalizer(question, options, normalizeMovieTitleInput);
}

function isControl(value) {
  return value && typeof value === "object" && value.type === "control";
}

function validateMovieCodeSyntax(code) {
  return /^M[0-9]{3}$/.test(code);
}

function validateScreeningCodeSyntax(code) {
  return /^S[0-9]{3}$/.test(code);
}

function validateReservationCodeSyntax(code) {
  return /^R[0-9]{3}$/.test(code);
}

function validateDisabledSeatCodeSyntax(code) {
  return /^D[0-9]{3}$/.test(code);
}

function validateTheaterCodeSyntax(code) {
  return /^T[1-9]$/.test(code);
}

function validateTheaterSyntax(code) {
  return validateTheaterCodeSyntax(code);
}

function validateMovieTitleSyntax(title) {
  return typeof title === "string" && title.trim().length > 0 && !/[|\r\n]/.test(title);
}

function validateRunningTime(value) {
  return /^[1-9][0-9]*$/.test(String(value)) && Number(value) <= 360;
}

function validatePositiveIntegerInRange(value, max) {
  return /^[1-9][0-9]*$/.test(String(value)) && Number(value) <= max;
}

function validateDateSyntax(date) {
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date);
}

function validateFlexibleDateSyntax(input) {
  return /^-*(\d-*){8}$/.test(input);
}

function normalizeDateInput(input) {
  const digits = input.replace(/-/g, "");
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

function validateDateSemantic(date) {
  if (!validateDateSyntax(date)) return false;
  const [year, month, day] = date.split("-").map(Number);
  if (year < 2000 || month < 1 || month > 12) return false;
  return day >= 1 && day <= new Date(year, month, 0).getDate();
}

function validateStartTimeSyntax(value) {
  return /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(value);
}

function validateTimeRangeSyntax(value) {
  return /^([0-1][0-9]|2[0-3]):[0-5][0-9] - ([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(value);
}

function timeToMinutes(value) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function parseTimeRange(value) {
  if (!validateTimeRangeSyntax(value)) return null;
  const [startText, endText] = value.split(" - ");
  const start = timeToMinutes(startText);
  let end = timeToMinutes(endText);
  if (end <= start) end += 24 * 60;
  return { start, end };
}

function validateMaxDuration(value) {
  const range = parseTimeRange(value);
  return Boolean(range && range.end - range.start <= 360);
}

function makeLocalDateTime(dateString, timeString) {
  const [year, month, day] = dateString.split("-").map(Number);
  const [hour, minute] = timeString.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function getScreeningDateTimeRange(screening) {
  const [startText, endText] = screening.time.split(" - ");
  const start = makeLocalDateTime(screening.date, startText);
  const end = makeLocalDateTime(screening.date, endText);
  if (end <= start) end.setDate(end.getDate() + 1);
  return { start, end };
}

function getAbsoluteRange(screening) {
  return getScreeningDateTimeRange(screening);
}

function isTimeOverlap(rangeA, rangeB) {
  return rangeA.start < rangeB.end && rangeB.start < rangeA.end;
}

function formatTime(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDateTime(date) {
  return `${formatDate(date)} ${formatTime(date)}`;
}

function formatTimeRangeFromStartAndRunningTime(startTime, runningTime, date = "2000-01-01") {
  const start = makeLocalDateTime(date, startTime);
  const end = new Date(start.getTime() + Number(runningTime) * 60 * 1000);
  return `${startTime} - ${formatTime(end)}`;
}

function getDisabledSeatDateRange(disabledSeat) {
  const start = makeLocalDateTime(disabledSeat.startDate, "00:00");
  const end = makeLocalDateTime(disabledSeat.endDate, "00:00");
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function isScreeningStartedOrPast(screening, state) {
  return getScreeningDateTimeRange(screening).start <= state.currentDateTime;
}

function isScreeningEnded(screening, state) {
  return getScreeningDateTimeRange(screening).end <= state.currentDateTime;
}

function isScreeningNowPlaying(screening, state) {
  const range = getScreeningDateTimeRange(screening);
  return range.start <= state.currentDateTime && state.currentDateTime < range.end;
}

function isScreeningBookable(screening, state) {
  return getScreeningDateTimeRange(screening).start > state.currentDateTime;
}

function rowCharToNumber(rowChar) {
  return rowChar.charCodeAt(0) - 64;
}

function rowNumberToChar(rowNumber) {
  return String.fromCharCode(64 + rowNumber);
}

function getTheaterDisplayNumber(theaterId) {
  return theaterId.slice(1);
}

function getTheaterById(theaterId, theaters) {
  return theaters.find((theater) => theater.id === theaterId);
}

function getMovieById(movieId, movies) {
  return movies.find((movie) => movie.id === movieId);
}

function getMovieTitle(movieId, movies) {
  const movie = getMovieById(movieId, movies);
  return movie ? movie.title : "알 수 없는 영화";
}

function getScreeningById(screeningId, screenings) {
  return screenings.find((screening) => screening.id === screeningId);
}

function parseSeatInput(input) {
  const match = input.match(/^([A-Z])([1-9][0-9]?)$/);
  return match ? { row: match[1], col: Number(match[2]) } : null;
}

function validateSeatSemantic(theater, seat) {
  const row = rowCharToNumber(seat.row);
  return row >= 1 && row <= theater.rows && seat.col >= 1 && seat.col <= theater.cols;
}

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

function normalizePhone(phone) {
  return phone.replace(/-/g, "");
}

function samePhone(a, b) {
  return normalizePhone(a) === normalizePhone(b);
}

function isSeatReserved(screeningId, seat, reservations) {
  return reservations.some((reservation) =>
    reservation.screeningId === screeningId &&
    reservation.seatRow === seat.row &&
    reservation.seatCol === seat.col);
}

function isSeatDisabled(screening, seat, state) {
  const screeningRange = getScreeningDateTimeRange(screening);
  const row = rowCharToNumber(seat.row);
  return state.disabledSeats.some((disabledSeat) =>
    disabledSeat.theaterId === screening.theaterId &&
    disabledSeat.row === row &&
    disabledSeat.col === seat.col &&
    isTimeOverlap(screeningRange, getDisabledSeatDateRange(disabledSeat)));
}

function makeFileError(fileName, lineNo, reason) {
  return `[파일 오류] ${fileName} ${lineNo}번째 줄: ${reason}`;
}

function parseMoviesRawLines(lines) {
  const ids = new Set();
  return lines.map((line, index) => {
    const fields = line.split("|");
    if (fields.length !== 3) throw new Error(makeFileError(MOVIES_FILE, index + 1, "필드 수는 3개여야 합니다."));
    const [id, rawTitle, runningTimeText] = fields;
    const title = rawTitle.trim();
    if (!validateMovieCodeSyntax(id)) throw new Error(makeFileError(MOVIES_FILE, index + 1, `영화코드(${id}) 형식이 올바르지 않습니다.`));
    if (ids.has(id)) throw new Error(makeFileError(MOVIES_FILE, index + 1, `중복된 영화코드(${id})입니다.`));
    if (!validateMovieTitleSyntax(title)) throw new Error(makeFileError(MOVIES_FILE, index + 1, "영화 제목이 올바르지 않습니다."));
    if (!validateRunningTime(runningTimeText)) throw new Error(makeFileError(MOVIES_FILE, index + 1, "러닝타임은 1~360의 정수여야 합니다."));
    ids.add(id);
    return { id, title, runningTime: Number(runningTimeText) };
  });
}

function parseTheatersRawLines(lines) {
  const ids = new Set();
  return lines.map((line, index) => {
    const fields = line.split("|");
    if (fields.length !== 3) throw new Error(makeFileError(THEATERS_FILE, index + 1, "필드 수는 3개여야 합니다."));
    const [id, rowsText, colsText] = fields;
    if (!validateTheaterCodeSyntax(id)) throw new Error(makeFileError(THEATERS_FILE, index + 1, `상영관코드(${id}) 형식이 올바르지 않습니다.`));
    if (ids.has(id)) throw new Error(makeFileError(THEATERS_FILE, index + 1, `중복된 상영관코드(${id})입니다.`));
    if (!validatePositiveIntegerInRange(rowsText, 26)) throw new Error(makeFileError(THEATERS_FILE, index + 1, "행 수는 1~26의 정수여야 합니다."));
    if (!validatePositiveIntegerInRange(colsText, 99)) throw new Error(makeFileError(THEATERS_FILE, index + 1, "열 수는 1~99의 정수여야 합니다."));
    ids.add(id);
    return { id, rows: Number(rowsText), cols: Number(colsText) };
  });
}

function parseScreeningsRawLines(lines, movies, theaters) {
  const ids = new Set();
  const screenings = lines.map((line, index) => {
    const fields = line.split("|");
    if (fields.length !== 5) throw new Error(makeFileError(SCREENINGS_FILE, index + 1, "필드 수는 5개여야 합니다."));
    const [id, movieId, theaterId, date, time] = fields;
    const movie = getMovieById(movieId, movies);
    if (!validateScreeningCodeSyntax(id)) throw new Error(makeFileError(SCREENINGS_FILE, index + 1, `상영코드(${id}) 형식이 올바르지 않습니다.`));
    if (ids.has(id)) throw new Error(makeFileError(SCREENINGS_FILE, index + 1, `중복된 상영코드(${id})입니다.`));
    if (!movie) throw new Error(makeFileError(SCREENINGS_FILE, index + 1, `존재하지 않는 영화코드(${movieId}) 참조입니다.`));
    if (!getTheaterById(theaterId, theaters)) throw new Error(makeFileError(SCREENINGS_FILE, index + 1, `존재하지 않는 상영관코드(${theaterId}) 참조입니다.`));
    if (!validateDateSyntax(date) || !validateDateSemantic(date)) throw new Error(makeFileError(SCREENINGS_FILE, index + 1, `상영 날짜(${date})가 올바르지 않습니다.`));
    const range = parseTimeRange(time);
    if (!range || !validateMaxDuration(time)) throw new Error(makeFileError(SCREENINGS_FILE, index + 1, `상영 시간(${time})이 올바르지 않습니다.`));
    if (range.end - range.start !== movie.runningTime) throw new Error(makeFileError(SCREENINGS_FILE, index + 1, `상영 시간이 영화(${movieId}) 러닝타임과 일치하지 않습니다.`));
    ids.add(id);
    return { id, movieId, theaterId, date, time };
  });
  for (let i = 0; i < screenings.length; i += 1) {
    for (let j = i + 1; j < screenings.length; j += 1) {
      if (screenings[i].theaterId === screenings[j].theaterId &&
          isTimeOverlap(getAbsoluteRange(screenings[i]), getAbsoluteRange(screenings[j]))) {
        throw new Error(makeFileError(SCREENINGS_FILE, j + 1, `같은 상영관(${screenings[j].theaterId})에서 시간이 겹칩니다.`));
      }
    }
  }
  return screenings;
}

function parseDisabledSeatsRawLines(lines, theaters) {
  const ids = new Set();
  const disabledSeats = lines.map((line, index) => {
    const fields = line.split("|");
    if (fields.length !== 6) throw new Error(makeFileError(DISABLED_SEATS_FILE, index + 1, "필드 수는 6개여야 합니다."));
    const [id, theaterId, rowText, colText, startDate, endDate] = fields;
    const theater = getTheaterById(theaterId, theaters);
    if (!validateDisabledSeatCodeSyntax(id)) throw new Error(makeFileError(DISABLED_SEATS_FILE, index + 1, `사용금지좌석코드(${id}) 형식이 올바르지 않습니다.`));
    if (ids.has(id)) throw new Error(makeFileError(DISABLED_SEATS_FILE, index + 1, `중복된 사용금지좌석코드(${id})입니다.`));
    if (!theater) throw new Error(makeFileError(DISABLED_SEATS_FILE, index + 1, `존재하지 않는 상영관코드(${theaterId}) 참조입니다.`));
    if (!validatePositiveIntegerInRange(rowText, theater.rows) || !validatePositiveIntegerInRange(colText, theater.cols)) {
      throw new Error(makeFileError(DISABLED_SEATS_FILE, index + 1, "좌석 범위를 벗어났습니다."));
    }
    if (!validateDateSyntax(startDate) || !validateDateSemantic(startDate) || !validateDateSyntax(endDate) || !validateDateSemantic(endDate)) {
      throw new Error(makeFileError(DISABLED_SEATS_FILE, index + 1, "사용금지 날짜가 올바르지 않습니다."));
    }
    if (makeLocalDateTime(endDate, "00:00") < makeLocalDateTime(startDate, "00:00")) {
      throw new Error(makeFileError(DISABLED_SEATS_FILE, index + 1, "종료 날짜는 시작 날짜보다 이전일 수 없습니다."));
    }
    ids.add(id);
    return { id, theaterId, row: Number(rowText), col: Number(colText), startDate, endDate };
  });
  for (let i = 0; i < disabledSeats.length; i += 1) {
    for (let j = i + 1; j < disabledSeats.length; j += 1) {
      const a = disabledSeats[i];
      const b = disabledSeats[j];
      if (a.theaterId === b.theaterId && a.row === b.row && a.col === b.col &&
          isTimeOverlap(getDisabledSeatDateRange(a), getDisabledSeatDateRange(b))) {
        throw new Error(makeFileError(DISABLED_SEATS_FILE, j + 1, "같은 좌석의 사용금지 기간이 겹칩니다."));
      }
    }
  }
  return disabledSeats;
}

function parseReservationsRawLines(lines, screenings, theaters, disabledSeats) {
  const ids = new Set();
  const reservations = [];
  const stateForDisabledCheck = { disabledSeats };
  lines.forEach((line, index) => {
    const fields = line.split("|");
    if (fields.length !== 4) throw new Error(makeFileError(RESERVATIONS_FILE, index + 1, "필드 수는 4개여야 합니다."));
    const [id, phone, screeningId, seatText] = fields;
    const screening = getScreeningById(screeningId, screenings);
    const seat = parseSeatInput(seatText);
    if (!validateReservationCodeSyntax(id)) throw new Error(makeFileError(RESERVATIONS_FILE, index + 1, `예매코드(${id}) 형식이 올바르지 않습니다.`));
    if (ids.has(id)) throw new Error(makeFileError(RESERVATIONS_FILE, index + 1, `중복된 예매코드(${id})입니다.`));
    if (!/^[0-9]+$/.test(phone) || !validatePhoneSyntax(phone)) throw new Error(makeFileError(RESERVATIONS_FILE, index + 1, `전화번호(${phone}) 형식이 올바르지 않습니다.`));
    if (!screening) throw new Error(makeFileError(RESERVATIONS_FILE, index + 1, `존재하지 않는 상영코드(${screeningId}) 참조입니다.`));
    if (!seat) throw new Error(makeFileError(RESERVATIONS_FILE, index + 1, `좌석(${seatText}) 형식이 올바르지 않습니다.`));
    const theater = getTheaterById(screening.theaterId, theaters);
    if (!validateSeatSemantic(theater, seat)) throw new Error(makeFileError(RESERVATIONS_FILE, index + 1, `좌석(${seatText})이 상영관 범위를 벗어났습니다.`));
    if (isSeatReserved(screeningId, seat, reservations)) throw new Error(makeFileError(RESERVATIONS_FILE, index + 1, "같은 상영의 좌석이 중복 예매되어 있습니다."));
    if (isSeatDisabled(screening, seat, stateForDisabledCheck)) throw new Error(makeFileError(RESERVATIONS_FILE, index + 1, "사용금지 좌석이 예매되어 있습니다."));
    if (hasTimeConflict(phone, screening, reservations, screenings)) throw new Error(makeFileError(RESERVATIONS_FILE, index + 1, "동일 전화번호로 시간이 겹치는 상영이 예매되어 있습니다."));
    ids.add(id);
    reservations.push({ id, phone, screeningId, seatRow: seat.row, seatCol: seat.col });
  });
  return reservations;
}

function parseAndValidateFiles() {
  const movies = parseMoviesRawLines(readRawLines(MOVIES_FILE));
  const theaters = parseTheatersRawLines(readRawLines(THEATERS_FILE));
  const screenings = parseScreeningsRawLines(readRawLines(SCREENINGS_FILE), movies, theaters);
  const disabledSeats = parseDisabledSeatsRawLines(readRawLines(DISABLED_SEATS_FILE), theaters);
  const reservations = parseReservationsRawLines(readRawLines(RESERVATIONS_FILE), screenings, theaters, disabledSeats);
  return { movies, screenings, theaters, disabledSeats, reservations, currentDateTime: null };
}

function saveMovies(state) {
  writeLines(MOVIES_FILE, state.movies.map((movie) => `${movie.id}|${movie.title.trim()}|${movie.runningTime}`));
}

function saveTheaters(state) {
  writeLines(THEATERS_FILE, state.theaters.map((theater) => `${theater.id}|${theater.rows}|${theater.cols}`));
}

function saveScreenings(state) {
  writeLines(SCREENINGS_FILE, state.screenings.map((screening) => `${screening.id}|${screening.movieId}|${screening.theaterId}|${screening.date}|${screening.time}`));
}

function saveDisabledSeats(state) {
  writeLines(DISABLED_SEATS_FILE, state.disabledSeats.map((seat) => `${seat.id}|${seat.theaterId}|${seat.row}|${seat.col}|${seat.startDate}|${seat.endDate}`));
}

function saveReservations(state) {
  writeLines(RESERVATIONS_FILE, state.reservations.map((reservation) => `${reservation.id}|${reservation.phone}|${reservation.screeningId}|${reservation.seatRow}${reservation.seatCol}`));
}

function generateNextId(prefix, usedIds, maxNumber) {
  const used = new Set(usedIds);
  for (let index = 0; index <= maxNumber; index += 1) {
    const candidate = `${prefix}${String(index).padStart(3, "0")}`;
    if (!used.has(candidate)) return candidate;
  }
  return null;
}

function generateNextTheaterId(theaters) {
  for (let index = 1; index <= 9; index += 1) {
    const candidate = `T${index}`;
    if (!theaters.some((theater) => theater.id === candidate)) return candidate;
  }
  return null;
}

function hasTimeConflict(phone, selectedScreening, reservations, screenings) {
  const selectedRange = getAbsoluteRange(selectedScreening);
  return reservations.some((reservation) => {
    if (!samePhone(reservation.phone, phone) || reservation.screeningId === selectedScreening.id) return false;
    const screening = getScreeningById(reservation.screeningId, screenings);
    return Boolean(screening && isTimeOverlap(selectedRange, getAbsoluteRange(screening)));
  });
}

function printMovies(movies) {
  console.log("\n[영화 목록]");
  movies.forEach((movie, index) => console.log(`${index + 1}. ${movie.title} (${movie.id}, ${movie.runningTime}분)`));
}

function printTheaters(theaters) {
  console.log("\n[상영관 목록]");
  theaters.forEach((theater) => console.log(`${theater.id} | ${theater.rows}행 ${theater.cols}열`));
}

function printScreenings(screenings, state) {
  console.log("\n[상영 정보]");
  screenings.forEach((screening, index) => {
    const theater = getTheaterById(screening.theaterId, state.theaters);
    console.log(`${index + 1}. ${screening.id} | ${getMovieTitle(screening.movieId, state.movies)} | ${getTheaterDisplayNumber(screening.theaterId)}관 | ${screening.date} | ${screening.time} | 총 ${theater.rows * theater.cols}석`);
  });
}

function displaySeats(screening, state) {
  const theater = getTheaterById(screening.theaterId, state.theaters);
  console.log("\n[좌석 배치도]");
  process.stdout.write("    ");
  for (let col = 1; col <= theater.cols; col += 1) process.stdout.write(`${String(col).padStart(2, " ")} `);
  console.log();
  for (let row = 1; row <= theater.rows; row += 1) {
    const rowChar = rowNumberToChar(row);
    process.stdout.write(`${rowChar} | `);
    for (let col = 1; col <= theater.cols; col += 1) {
      const seat = { row: rowChar, col };
      const unavailable = isSeatReserved(screening.id, seat, state.reservations) || isSeatDisabled(screening, seat, state);
      process.stdout.write(`${unavailable ? "X" : "O"}  `);
    }
    console.log();
  }
  console.log("O: 예약 가능, X: 선택 불가");
}

async function askValidDate(question) {
  while (true) {
    const input = await askInput(question);
    if (isControl(input)) return input;
    if (!validateFlexibleDateSyntax(input)) {
      console.log("날짜 형식이 올바르지 않습니다. 숫자 8개와 '-'만 입력하세요.");
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

async function inputInitialCurrentDateTime(state) {
  while (true) {
    const date = await askValidDate("현재 날짜를 입력하세요: ");
    if (isControl(date)) continue;
    const time = await askValidStartTime("현재 시간을 입력하세요 (HH:MM): ");
    if (isControl(time)) continue;
    state.currentDateTime = makeLocalDateTime(date, time);
    return;
  }
}

async function selectMovieStep(state) {
  const movies = state.movies.filter((movie) => state.screenings.some((screening) => screening.movieId === movie.id && isScreeningBookable(screening, state)));
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

async function selectDateStep(movieScreenings, state) {
  const dates = [...new Set(movieScreenings.filter((screening) => isScreeningBookable(screening, state)).map((screening) => screening.date))].sort();
  console.log("\n[상영 가능 날짜]");
  dates.forEach((date) => console.log(`- ${date}`));
  while (true) {
    const date = await askValidDate("상영 날짜를 입력하세요: ");
    if (isControl(date)) return date;
    if (!dates.includes(date)) {
      console.log("해당 날짜에는 선택한 영화의 예매 가능한 상영 정보가 없습니다.");
      continue;
    }
    return date;
  }
}

async function selectScreeningStep(screenings, state) {
  const bookable = screenings.filter((screening) => isScreeningBookable(screening, state));
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
      console.log("올바른 상영 번호를 입력하세요.");
      continue;
    }
    return bookable[index - 1];
  }
}

async function inputPhoneStep(state, screening) {
  while (true) {
    const input = await askInput("전화번호를 입력하세요: ");
    if (isControl(input)) return input;
    if (!validatePhoneSyntax(input)) {
      console.log("전화번호 형식이 올바르지 않습니다.");
      continue;
    }
    if (hasTimeConflict(input, screening, state.reservations, state.screenings)) {
      console.log("해당 전화번호로 시간이 겹치는 상영의 예매가 이미 있습니다.");
      continue;
    }
    return normalizePhone(input);
  }
}

async function selectSeatStep(state, screening) {
  const theater = getTheaterById(screening.theaterId, state.theaters);
  while (true) {
    displaySeats(screening, state);
    const input = await askInput(`좌석을 입력하세요 (예: A1 ~ ${rowNumberToChar(theater.rows)}${theater.cols}): `);
    if (isControl(input)) return input;
    const seat = parseSeatInput(input);
    if (!seat) {
      console.log("좌석 입력 형식이 올바르지 않습니다. 예: A1, B3, C10");
      continue;
    }
    if (!validateSeatSemantic(theater, seat)) {
      console.log("좌석 범위를 벗어났습니다.");
      continue;
    }
    if (isSeatReserved(screening.id, seat, state.reservations)) {
      console.log("이미 예매된 좌석입니다.");
      continue;
    }
    if (isSeatDisabled(screening, seat, state)) {
      console.log("사용금지 좌석은 예매할 수 없습니다.");
      continue;
    }
    return seat;
  }
}

async function confirmReservationStep(movie, screening, phone, seat) {
  console.log("\n[예매 확인]");
  console.log(`영화: ${movie.title}`);
  console.log(`상영관: ${getTheaterDisplayNumber(screening.theaterId)}관`);
  console.log(`날짜: ${screening.date}`);
  console.log(`시간: ${screening.time}`);
  console.log(`좌석: ${seat.row}${seat.col}`);
  console.log(`전화번호: ${phone}`);
  while (true) {
    const input = await askInput("예매를 확정하시겠습니까? (y/n): ");
    if (isControl(input)) return input;
    if (input === "y" || input === "yes") return true;
    if (input === "n" || input === "no") return false;
    console.log("y/n 또는 yes/no를 입력하세요.");
  }
}

function saveReservation(state, phone, screeningId, seat) {
  const id = generateNextId("R", state.reservations.map((reservation) => reservation.id), 999);
  if (!id) {
    console.log("더 이상 예매코드를 생성할 수 없습니다.");
    return false;
  }
  state.reservations.push({ id, phone, screeningId, seatRow: seat.row, seatCol: seat.col });
  saveReservations(state);
  return true;
}

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
      if (isControl(result)) return result.command === CMD.MAIN ? result : undefined;
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
        state.screenings.filter((item) => item.movieId === movie.id && item.date === date),
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
      const result = await confirmReservationStep(movie, screening, phone, seat);
      if (isControl(result)) {
        if (result.command === CMD.MAIN) return result;
        step = 5;
      } else if (!result) {
        console.log("예매를 진행하지 않았습니다.");
        step = 5;
      } else {
        if (saveReservation(state, phone, screening.id, seat)) console.log("예매가 완료되었습니다.");
        return;
      }
    }
  }
}

async function cancelReservationFlow(state, reservations) {
  while (true) {
    const input = await askInput("취소할 예매코드를 입력하세요 (취소하지 않으려면 back): ");
    if (isControl(input)) return input;
    if (!validateReservationCodeSyntax(input)) {
      console.log("예매 코드 형식이 올바르지 않습니다.");
      continue;
    }
    const reservation = reservations.find((item) => item.id === input);
    if (!reservation) {
      console.log("현재 조회한 예매 내역에 존재하지 않는 예매 코드입니다.");
      continue;
    }
    const screening = getScreeningById(reservation.screeningId, state.screenings);
    const remaining = getScreeningDateTimeRange(screening).start - state.currentDateTime;
    if (remaining <= 10 * 60 * 1000) {
      console.log("상영 시작 10분 전부터는 예매를 취소할 수 없습니다.");
      continue;
    }
    state.reservations = state.reservations.filter((item) => item.id !== reservation.id);
    saveReservations(state);
    console.log("예매가 취소되었습니다.");
    return;
  }
}

async function lookupReservationFlow(state) {
  while (true) {
    const phone = await askInput("조회할 전화번호를 입력하세요: ");
    if (isControl(phone)) return phone;
    if (!validatePhoneSyntax(phone)) {
      console.log("전화번호 형식이 올바르지 않습니다.");
      continue;
    }
    const reservations = state.reservations.filter((reservation) => samePhone(reservation.phone, phone));
    if (reservations.length === 0) {
      console.log("해당 전화번호로 예매된 내역이 없습니다.");
      return;
    }
    console.log("\n[예매 내역 조회]");
    reservations.forEach((reservation) => {
      const screening = getScreeningById(reservation.screeningId, state.screenings);
      console.log(`${reservation.id} | 영화: ${getMovieTitle(screening.movieId, state.movies)} | 상영관: ${getTheaterDisplayNumber(screening.theaterId)}관 | 날짜: ${screening.date} | 시간: ${screening.time} | 좌석: ${reservation.seatRow}${reservation.seatCol}`);
    });
    return cancelReservationFlow(state, reservations);
  }
}

async function changeCurrentDateTimeFlow(state) {
  while (true) {
    const date = await askValidDate("새 현재 날짜를 입력하세요: ");
    if (isControl(date)) return date;
    const time = await askValidStartTime("새 현재 시간을 입력하세요 (HH:MM): ");
    if (isControl(time)) return time;
    const next = makeLocalDateTime(date, time);
    if (next <= state.currentDateTime) {
      console.log("현재 시간은 기존 현재 시간보다 미래여야 합니다.");
      continue;
    }
    state.currentDateTime = next;
    console.log("현재 시간이 변경되었습니다.");
    return;
  }
}

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

async function addMovieFlow(state) {
  const id = generateNextId("M", state.movies.map((movie) => movie.id), 999);
  if (!id) return console.log("더 이상 영화 정보를 추가할 수 없습니다.");
  let title;
  while (true) {
    title = await askMovieTitle("영화 제목을 입력하세요: ");
    if (isControl(title)) return title;
    if (!validateMovieTitleSyntax(title)) {
      console.log("올바른 영화 제목을 입력하세요.");
      continue;
    }
    break;
  }
  const runningTime = await askRunningTime();
  if (isControl(runningTime)) return runningTime;
  state.movies.push({ id, title, runningTime });
  saveMovies(state);
  console.log(`영화 정보가 추가되었습니다. (${id})`);
}

async function deleteMovieFlow(state) {
  printMovies(state.movies);
  const movie = await askMovieCode(state, "삭제할 영화코드를 입력하세요: ");
  if (isControl(movie)) return movie;
  const relatedScreenings = state.screenings.filter((screening) => screening.movieId === movie.id);
  if (relatedScreenings.some((screening) => getScreeningDateTimeRange(screening).end <= state.currentDateTime)) {
    console.log("해당 영화와 관련된 이미 종료된 상영 정보가 존재하여 삭제할 수 없습니다.");
    return;
  }
  if (relatedScreenings.some((screening) => {
    const range = getScreeningDateTimeRange(screening);
    return range.start <= state.currentDateTime && state.currentDateTime < range.end;
  })) {
    console.log("해당 영화와 관련된 현재 상영 중인 상영 정보가 존재하여 삭제할 수 없습니다.");
    return;
  }
  if (relatedScreenings.some((screening) =>
    state.reservations.some((reservation) => reservation.screeningId === screening.id))) {
    console.log("해당 영화와 관련된 예매 내역이 존재하여 삭제할 수 없습니다.");
    return;
  }
  state.movies = state.movies.filter((item) => item.id !== movie.id);
  state.screenings = state.screenings.filter((screening) => screening.movieId !== movie.id);
  saveMovies(state);
  saveScreenings(state);
  console.log("영화 정보가 삭제되었습니다.");
}

function validateScreeningSchedule(candidate, state, excludedId = null) {
  return !state.screenings.some((screening) =>
    screening.id !== excludedId &&
    screening.theaterId === candidate.theaterId &&
    isTimeOverlap(getAbsoluteRange(candidate), getAbsoluteRange(screening)));
}

function validateReservationsForScreening(candidate, state) {
  const theater = getTheaterById(candidate.theaterId, state.theaters);
  const reservations = state.reservations.filter((reservation) => reservation.screeningId === candidate.id);
  return reservations.every((reservation) => {
    const seat = { row: reservation.seatRow, col: reservation.seatCol };
    return validateSeatSemantic(theater, seat) && !isSeatDisabled(candidate, seat, state);
  }) && reservations.every((reservation) =>
    !hasTimeConflict(reservation.phone, candidate, state.reservations.filter((item) => item.screeningId !== candidate.id), state.screenings));
}

async function updateMovieRunningTimeFlow(state) {
  printMovies(state.movies);
  const movie = await askMovieCode(state, "수정할 영화코드를 입력하세요: ");
  if (isControl(movie)) return movie;
  const relatedScreenings = state.screenings.filter((screening) => screening.movieId === movie.id);
  if (relatedScreenings.some((screening) => getScreeningDateTimeRange(screening).end <= state.currentDateTime)) {
    console.log("해당 영화와 관련된 이미 종료된 상영 정보가 존재하여 수정할 수 없습니다.");
    return;
  }
  if (relatedScreenings.some((screening) => {
    const range = getScreeningDateTimeRange(screening);
    return range.start <= state.currentDateTime && state.currentDateTime < range.end;
  })) {
    console.log("해당 영화와 관련된 현재 상영 중인 상영 정보가 존재하여 수정할 수 없습니다.");
    return;
  }
  if (relatedScreenings.some((screening) =>
    state.reservations.some((reservation) => reservation.screeningId === screening.id))) {
    console.log("해당 영화와 관련된 예매 내역이 존재하여 수정할 수 없습니다.");
    return;
  }
  const runningTime = await askRunningTime();
  if (isControl(runningTime)) return runningTime;
  const changed = state.screenings.map((screening) => screening.movieId === movie.id
    ? { ...screening, time: formatTimeRangeFromStartAndRunningTime(screening.time.split(" - ")[0], runningTime, screening.date) }
    : screening);
  const temporaryState = { ...state, screenings: changed };
  for (const screening of changed) {
    if (!validateScreeningSchedule(screening, temporaryState, screening.id) || !validateReservationsForScreening(screening, temporaryState)) {
      console.log("변경된 러닝타임이 기존 데이터와 충돌하여 수정할 수 없습니다.");
      return;
    }
  }
  movie.runningTime = runningTime;
  state.screenings = changed;
  saveMovies(state);
  saveScreenings(state);
  console.log("영화 정보가 수정되었습니다.");
}

async function movieManageMenuFlow(state) {
  while (true) {
    console.log("\n[영화 정보 관리]\n1. 영화 정보 추가\n2. 영화 정보 삭제\n3. 영화 러닝타임 수정");
    const choice = await askInput("메뉴 번호를 입력하세요: ");
    if (isControl(choice)) return choice.command === CMD.MAIN ? choice : undefined;
    let result;
    if (choice === "1") result = await addMovieFlow(state);
    else if (choice === "2") result = await deleteMovieFlow(state);
    else if (choice === "3") result = await updateMovieRunningTimeFlow(state);
    else console.log("올바른 메뉴 번호를 입력하세요.");
    if (isControl(result) && result.command === CMD.MAIN) return result;
  }
}

async function buildScreeningInput(state, id) {
  printMovies(state.movies);
  const movie = await askMovieCode(state, "영화코드를 입력하세요: ");
  if (isControl(movie)) return movie;
  printTheaters(state.theaters);
  const theater = await askTheater(state, "상영관코드를 입력하세요: ");
  if (isControl(theater)) return theater;
  const date = await askValidDate("상영 날짜를 입력하세요: ");
  if (isControl(date)) return date;
  const startTime = await askValidStartTime("상영 시작시간을 입력하세요 (HH:MM): ");
  if (isControl(startTime)) return startTime;
  const screening = { id, movieId: movie.id, theaterId: theater.id, date, time: formatTimeRangeFromStartAndRunningTime(startTime, movie.runningTime, date) };
  if (getScreeningDateTimeRange(screening).start <= state.currentDateTime) {
    console.log("현재 시간보다 이전 또는 같은 시각의 상영 정보는 등록할 수 없습니다.");
    return null;
  }
  if (!validateScreeningSchedule(screening, state, id)) {
    console.log("해당 상영관에 시간이 겹치는 상영 정보가 존재합니다.");
    return null;
  }
  return screening;
}

async function addScreeningFlow(state) {
  const id = generateNextId("S", state.screenings.map((screening) => screening.id), 999);
  if (!id) return console.log("더 이상 상영 정보를 추가할 수 없습니다.");
  const screening = await buildScreeningInput(state, id);
  if (isControl(screening)) return screening;
  if (!screening) return;
  state.screenings.push(screening);
  saveScreenings(state);
  console.log(`상영 정보가 추가되었습니다. (${id})`);
}

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

async function deleteScreeningFlow(state) {
  printScreenings(state.screenings, state);
  const screening = await askScreening(state, "삭제할 상영코드를 입력하세요: ");
  if (isControl(screening)) return screening;
  if (isScreeningEnded(screening, state)) return console.log("이미 종료된 상영 정보는 삭제할 수 없습니다.");
  if (isScreeningNowPlaying(screening, state)) return console.log("현재 상영 중인 상영 정보는 삭제할 수 없습니다.");
  if (state.reservations.some((reservation) => reservation.screeningId === screening.id)) return console.log("해당 상영 정보와 관련된 예매 내역이 존재하여 삭제할 수 없습니다.");
  state.screenings = state.screenings.filter((item) => item.id !== screening.id);
  saveScreenings(state);
  console.log("상영 정보가 삭제되었습니다.");
}

async function updateScreeningFlow(state) {
  printScreenings(state.screenings, state);
  const original = await askScreening(state, "수정할 상영코드를 입력하세요: ");
  if (isControl(original)) return original;
  if (isScreeningEnded(original, state)) return console.log("이미 종료된 상영 정보는 수정할 수 없습니다.");
  if (isScreeningNowPlaying(original, state)) return console.log("현재 상영 중인 상영 정보는 수정할 수 없습니다.");
  if (state.reservations.some((reservation) => reservation.screeningId === original.id)) {
    console.log("해당 상영 정보와 관련된 예매 내역이 존재하여 수정할 수 없습니다.");
    return;
  }
  const screening = await buildScreeningInput(state, original.id);
  if (isControl(screening)) return screening;
  if (!screening) return;
  if (!validateReservationsForScreening(screening, state)) return console.log("수정 후 기존 예매 내역과 충돌하여 수정할 수 없습니다.");
  state.screenings = state.screenings.map((item) => item.id === original.id ? screening : item);
  saveScreenings(state);
  console.log("상영 정보가 수정되었습니다.");
}

async function screeningManageMenuFlow(state) {
  while (true) {
    console.log("\n[상영 정보 관리]\n1. 상영 정보 추가\n2. 상영 정보 삭제\n3. 상영 정보 수정");
    const choice = await askInput("메뉴 번호를 입력하세요: ");
    if (isControl(choice)) return choice.command === CMD.MAIN ? choice : undefined;
    let result;
    if (choice === "1") result = await addScreeningFlow(state);
    else if (choice === "2") result = await deleteScreeningFlow(state);
    else if (choice === "3") result = await updateScreeningFlow(state);
    else console.log("올바른 메뉴 번호를 입력하세요.");
    if (isControl(result) && result.command === CMD.MAIN) return result;
  }
}

async function addTheaterFlow(state) {
  const id = generateNextTheaterId(state.theaters);
  if (!id) return console.log("더 이상 상영관 정보를 추가할 수 없습니다.");
  let rows;
  while (true) {
    rows = await askInput("행 수를 입력하세요: ");
    if (isControl(rows)) return rows;
    if (validatePositiveIntegerInRange(rows, 26)) break;
    console.log("행 수 입력 형식이 올바르지 않습니다.");
  }
  let cols;
  while (true) {
    cols = await askInput("열 수를 입력하세요: ");
    if (isControl(cols)) return cols;
    if (validatePositiveIntegerInRange(cols, 99)) break;
    console.log("열 수 입력 형식이 올바르지 않습니다.");
  }
  state.theaters.push({ id, rows: Number(rows), cols: Number(cols) });
  saveTheaters(state);
  console.log(`상영관 정보가 추가되었습니다. (${id})`);
}

async function deleteTheaterFlow(state) {
  printTheaters(state.theaters);
  const theater = await askTheater(state, "삭제할 상영관코드를 입력하세요: ");
  if (isControl(theater)) return theater;
  const screenings = state.screenings.filter((screening) => screening.theaterId === theater.id);
  if (screenings.some((screening) => isScreeningStartedOrPast(screening, state))) return console.log("이미 시작한 상영 정보와 관련된 상영관은 삭제할 수 없습니다.");
  if (screenings.some((screening) => state.reservations.some((reservation) => reservation.screeningId === screening.id))) return console.log("해당 상영관 정보와 관련된 예매 내역이 존재하여 삭제할 수 없습니다.");
  state.theaters = state.theaters.filter((item) => item.id !== theater.id);
  state.screenings = state.screenings.filter((screening) => screening.theaterId !== theater.id);
  state.disabledSeats = state.disabledSeats.filter((seat) => seat.theaterId !== theater.id);
  saveTheaters(state);
  saveScreenings(state);
  saveDisabledSeats(state);
  console.log("상영관 정보가 삭제되었습니다.");
}

async function addDisabledSeatFlow(state) {
  const id = generateNextId("D", state.disabledSeats.map((seat) => seat.id), 999);
  if (!id) return console.log("더 이상 사용금지 좌석 정보를 추가할 수 없습니다.");
  printTheaters(state.theaters);
  const theater = await askTheater(state, "상영관코드를 입력하세요: ");
  if (isControl(theater)) return theater;
  let seat;
  while (true) {
    const input = await askInput("사용금지 좌석을 입력하세요 (예: A1): ");
    if (isControl(input)) return input;
    seat = parseSeatInput(input);
    if (seat && validateSeatSemantic(theater, seat)) break;
    console.log("좌석 입력 형식 또는 범위가 올바르지 않습니다.");
  }
  const startDate = await askValidDate("사용금지 시작 날짜를 입력하세요: ");
  if (isControl(startDate)) return startDate;
  const endDate = await askValidDate("사용금지 종료 날짜를 입력하세요: ");
  if (isControl(endDate)) return endDate;
  if (startDate < formatDate(state.currentDateTime)) return console.log("현재 날짜보다 과거의 날짜는 입력할 수 없습니다.");
  if (endDate < startDate) return console.log("사용금지 종료날짜는 시작날짜보다 이전일 수 없습니다.");
  const disabledSeat = { id, theaterId: theater.id, row: rowCharToNumber(seat.row), col: seat.col, startDate, endDate };
  const disabledRange = getDisabledSeatDateRange(disabledSeat);
  const overlap = state.disabledSeats.find((item) => item.theaterId === disabledSeat.theaterId && item.row === disabledSeat.row && item.col === disabledSeat.col && isTimeOverlap(disabledRange, getDisabledSeatDateRange(item)));
  if (overlap) return console.log(`해당 기간에 이미 사용 금지로 설정된 좌석입니다. (${overlap.startDate} ~ ${overlap.endDate})`);
  const conflictingReservation = state.reservations.find((reservation) => {
    const screening = getScreeningById(reservation.screeningId, state.screenings);
    return screening.theaterId === theater.id && reservation.seatRow === seat.row && reservation.seatCol === seat.col && isTimeOverlap(getAbsoluteRange(screening), disabledRange);
  });
  if (conflictingReservation) return console.log("해당 기간에 해당 좌석의 예매 내역이 존재하여 사용 금지 설정을 할 수 없습니다.");
  state.disabledSeats.push(disabledSeat);
  saveDisabledSeats(state);
  console.log(`좌석 사용금지 정보가 추가되었습니다. (${id})`);
}

async function theaterManageMenuFlow(state) {
  while (true) {
    console.log("\n[상영관 정보 관리]\n1. 상영관 정보 추가\n2. 상영관 정보 삭제\n3. 좌석 사용금지 설정");
    const choice = await askInput("메뉴 번호를 입력하세요: ");
    if (isControl(choice)) return choice.command === CMD.MAIN ? choice : undefined;
    let result;
    if (choice === "1") result = await addTheaterFlow(state);
    else if (choice === "2") result = await deleteTheaterFlow(state);
    else if (choice === "3") result = await addDisabledSeatFlow(state);
    else console.log("올바른 메뉴 번호를 입력하세요.");
    if (isControl(result) && result.command === CMD.MAIN) return result;
  }
}

async function adminMenuFlow(state) {
  while (true) {
    console.log("\n[관리자 메뉴]\n1. 영화 정보 관리\n2. 상영 정보 관리\n3. 상영관 정보 관리");
    const choice = await askInput("메뉴 번호를 입력하세요: ");
    if (isControl(choice)) return choice.command === CMD.MAIN ? choice : undefined;
    let result;
    if (choice === "1") result = await movieManageMenuFlow(state);
    else if (choice === "2") result = await screeningManageMenuFlow(state);
    else if (choice === "3") result = await theaterManageMenuFlow(state);
    else console.log("올바른 메뉴 번호를 입력하세요.");
    if (isControl(result) && result.command === CMD.MAIN) return result;
  }
}

async function authenticateAdminFlow(state) {
  while (true) {
    const password = await askInput("관리자 비밀번호를 입력하세요: ");
    if (isControl(password)) return password;
    if (password === ADMIN_PASSWORD) return adminMenuFlow(state);
    console.log("올바른 비밀번호를 입력하세요.");
  }
}

function printMainMenu(state) {
  console.log("\n==============================");
  console.log("영화 예매 시스템");
  console.log(`현재 시간: ${formatDateTime(state.currentDateTime)}`);
  console.log("==============================");
  console.log("1. 영화 예매");
  console.log("2. 예매 내역 조회 / 취소");
  console.log("3. 현재 시간 변경");
  console.log("4. 관리자 기능");
  console.log("5. 종료");
  console.log("==============================");
}

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
    const choice = await askInput("메뉴 번호를 입력하세요: ", { allowBack: false, allowMain: false });
    if (choice === "1") await reserveMovieFlow(state);
    else if (choice === "2") await lookupReservationFlow(state);
    else if (choice === "3") await changeCurrentDateTimeFlow(state);
    else if (choice === "4") await authenticateAdminFlow(state);
    else if (choice === "5") return safeExit();
    else console.log("올바른 메뉴 번호를 입력하세요.");
  }
}

main();
