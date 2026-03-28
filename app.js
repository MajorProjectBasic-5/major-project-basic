const fs = require("fs");
const readline = require("readline");

const MOVIES_FILE = "movies.txt";
const SCREENINGS_FILE = "screenings.txt";
const RESERVATIONS_FILE = "reservations.txt";

const CMD = {
  HELP: "help",
  QUIT: "quit",
  BACK: "back",
  MAIN: "main",
};

const CTRL = {
  BACK: { type: "control", command: CMD.BACK },
  MAIN: { type: "control", command: CMD.MAIN },
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ensureFileExists(fileName) {
  if (!fs.existsSync(fileName)) {
    fs.writeFileSync(fileName, "", "utf8");
  }
}

function readRawLines(fileName) {
  ensureFileExists(fileName);
  const content = fs.readFileSync(fileName, "utf8");
  if (!content.trim()) return [];
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
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

function askRaw(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

async function askInput(question, options = {}) {
  const { allowBack = true, allowMain = true } = options;

  while (true) {
    const input = await askRaw(question);
    const lowered = input.toLowerCase();

    if (!input) {
      console.log("빈 입력은 허용되지 않습니다. back/main/help/quit 또는 올바른 값을 입력하세요.");
      continue;
    }

    if (lowered === CMD.HELP) {
      printHelp();
      continue;
    }

    if (lowered === CMD.QUIT) {
      safeExit();
    }

    if (lowered === CMD.BACK) {
      if (!allowBack) {
        console.log("이미 최상위 메뉴입니다.");
        continue;
      }
      return CTRL.BACK;
    }

    if (lowered === CMD.MAIN) {
      if (!allowMain) {
        console.log("이미 메인 메뉴입니다.");
        continue;
      }
      return CTRL.MAIN;
    }

    return input;
  }
}

function isControl(result) {
  return result && typeof result === "object" && result.type === "control";
}

function validateMovieTitleSyntax(title) {
  return /^[^\s].*/.test(title) && title.length >= 1;
}

function validateMovieCodeSyntax(code) {
  return /^[a-zA-Z0-9]{4}$/.test(code);
}

function validateCompatibleMovieCode(code) {
  return /^[a-zA-Z0-9]+$/.test(code);
}

function validateScreeningCodeSyntax(code) {
  return /^[a-zA-Z0-9]{4}$/.test(code);
}

function validateCompatibleScreeningCode(code) {
  return /^[a-zA-Z0-9]+$/.test(code);
}

function normalizeTheater(theater) {
  return theater.replace(/관$/, "");
}

function validateTheaterSyntax(theater) {
  return /^[1-9][0-9]?$/.test(normalizeTheater(theater));
}

function validateDateSyntax(date) {
  return /^20[0-9]{2}-[0-9]{2}-[0-9]{2}$/.test(date);
}

function validateDateSemantic(date) {
  if (!validateDateSyntax(date)) return false;
  const [yearStr, monthStr, dayStr] = date.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (month < 1 || month > 12) return false;

  const lastDay = new Date(year, month, 0).getDate();
  return day >= 1 && day <= lastDay;
}

function validateSingleTimeSyntax(time) {
  return /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/.test(time);
}

function validateTimeRangeSyntax(time) {
  return /^([0-1][0-9]|2[0-3]):([0-5][0-9])\s-\s([0-1][0-9]|2[0-3]):([0-5][0-9])$/.test(time);
}

function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function parseTimeWindow(time) {
  // 명세상 상영 시간은 "시작-종료" 형식이지만, 현재 샘플 데이터는 시작 시각(HH:MM)만 사용한다.
  if (validateTimeRangeSyntax(time)) {
    const [start, end] = time.split(" - ");
    return { start: timeToMinutes(start), end: timeToMinutes(end), ranged: true };
  }

  if (validateSingleTimeSyntax(time)) {
    const point = timeToMinutes(time);
    return { start: point, end: point, ranged: false };
  }

  return null;
}

function validateTimeSemantic(time) {
  const window = parseTimeWindow(time);
  if (!window) return false;
  if (!window.ranged) return true;
  return window.start < window.end;
}

function validateSeatGridSyntax(rows, cols) {
  return /^[1-9][0-9]*$/.test(String(rows)) && /^[1-9][0-9]*$/.test(String(cols));
}

function validateSeatGridSemantic(rows, cols) {
  return rows > 0 && cols > 0 && rows * cols <= 200;
}

function validateReservationCodeSyntax(code) {
  return /^[0-9]{4}$/.test(code);
}

function validateCompatibleReservationCode(code) {
  // TODO: 공식 명세([0-9]{4})와 샘플 데이터(R1, R2...)가 충돌하여 현재는 호환 형식을 유지한다.
  return /^R[0-9]+$/.test(code) || validateReservationCodeSyntax(code);
}

function validatePhoneSyntax(phone) {
  if (!/^[0-9-]+$/.test(phone)) return false;
  if (!/[0-9]$/.test(phone)) return false;

  const digits = phone.replace(/-/g, "");
  if (digits.length < 6) return false;

  if (digits.startsWith("010")) {
    return digits.length === 11;
  }

  if (digits.startsWith("01") && digits[2] !== "0") {
    return digits.length === 10 || digits.length === 11;
  }

  return true;
}

function normalizePhone(phone) {
  return phone.replace(/-/g, "");
}

function validateSeatSyntax(input) {
  return /^[A-Z](0[1-9]|[1-9][0-9])$/.test(input.toUpperCase());
}

function normalizeSeat(input) {
  const upper = input.toUpperCase();
  const row = upper[0];
  const col = Number(upper.slice(1));
  return { row, col };
}

function validateSeatSemantic(screening, seat) {
  const rowIndex = seat.row.charCodeAt(0) - 65;
  return rowIndex >= 0 && rowIndex < screening.rows && seat.col >= 1 && seat.col <= screening.cols;
}

function samePhone(a, b) {
  return normalizePhone(a) === normalizePhone(b);
}

function getMovieTitle(movieId, movies) {
  const movie = movies.find((m) => m.id === movieId);
  return movie ? movie.title : "알 수 없는 영화";
}

function getScreeningById(screeningId, screenings) {
  return screenings.find((s) => s.id === screeningId);
}

function makeFileError(fileName, lineNo, reason) {
  return `[파일 오류] ${fileName} ${lineNo}번째 줄: ${reason}`;
}

function parseAndValidateFiles() {
  const moviesRaw = readRawLines(MOVIES_FILE);
  const screeningsRaw = readRawLines(SCREENINGS_FILE);
  const reservationsRaw = readRawLines(RESERVATIONS_FILE);

  const movies = moviesRaw.map((line, i) => {
    const fields = line.split("|");
    if (fields.length !== 2) {
      throw new Error(makeFileError(MOVIES_FILE, i + 1, "필드 개수가 올바르지 않습니다. (movieId|title)"));
    }

    const [id, title] = fields;
    if (!validateCompatibleMovieCode(id)) {
      throw new Error(makeFileError(MOVIES_FILE, i + 1, `movieId(${id}) 형식이 올바르지 않습니다.`));
    }

    if (!validateMovieTitleSyntax(title)) {
      throw new Error(makeFileError(MOVIES_FILE, i + 1, "영화 제목 형식이 올바르지 않습니다."));
    }

    // 의미 규칙 메모: 영상물 등급 위원회 기준 통과 여부는 외부 검증이 필요해 프로그램 내 검증 불가.
    return { id, title };
  });

  const movieIdSet = new Set(movies.map((m) => m.id));
  const screeningIdSet = new Set();

  const screenings = screeningsRaw.map((line, i) => {
    const fields = line.split("|");
    if (fields.length !== 7) {
      throw new Error(
        makeFileError(SCREENINGS_FILE, i + 1, "필드 개수가 올바르지 않습니다. (screeningId|movieId|theater|date|time|rows|cols)")
      );
    }

    const [id, movieId, theater, date, time, rowsRaw, colsRaw] = fields;
    const rows = Number(rowsRaw);
    const cols = Number(colsRaw);

    if (!validateCompatibleScreeningCode(id)) {
      throw new Error(makeFileError(SCREENINGS_FILE, i + 1, `screeningId(${id}) 형식이 올바르지 않습니다.`));
    }

    if (!movieIdSet.has(movieId)) {
      throw new Error(makeFileError(SCREENINGS_FILE, i + 1, `존재하지 않는 movieId(${movieId}) 참조`));
    }

    if (!validateTheaterSyntax(theater)) {
      throw new Error(makeFileError(SCREENINGS_FILE, i + 1, `상영관(${theater}) 형식이 올바르지 않습니다.`));
    }

    if (!validateDateSemantic(date)) {
      throw new Error(makeFileError(SCREENINGS_FILE, i + 1, `상영 날짜(${date})가 올바르지 않습니다.`));
    }

    if (!(validateTimeRangeSyntax(time) || validateSingleTimeSyntax(time)) || !validateTimeSemantic(time)) {
      throw new Error(makeFileError(SCREENINGS_FILE, i + 1, `상영 시간(${time})이 올바르지 않습니다.`));
    }

    if (!validateSeatGridSyntax(rowsRaw, colsRaw) || !validateSeatGridSemantic(rows, cols)) {
      throw new Error(makeFileError(SCREENINGS_FILE, i + 1, `좌석 정보(${rowsRaw}x${colsRaw})가 올바르지 않습니다.`));
    }

    if (screeningIdSet.has(id)) {
      throw new Error(makeFileError(SCREENINGS_FILE, i + 1, `중복된 screeningId(${id})가 있습니다.`));
    }
    screeningIdSet.add(id);

    return { id, movieId, theater, date, time, rows, cols };
  });

  const byTheaterDate = new Map();
  screenings.forEach((s, idx) => {
    const key = `${normalizeTheater(s.theater)}|${s.date}`;
    if (!byTheaterDate.has(key)) byTheaterDate.set(key, []);

    const window = parseTimeWindow(s.time);
    const currentList = byTheaterDate.get(key);

    for (const prev of currentList) {
      const overlap =
        window.ranged &&
        prev.window.ranged &&
        window.start < prev.window.end &&
        prev.window.start < window.end;

      if (overlap) {
        throw new Error(
          makeFileError(
            SCREENINGS_FILE,
            idx + 1,
            `같은 상영관/날짜의 시간이 겹칩니다. (${s.theater}, ${s.date}, ${s.time})`
          )
        );
      }
    }

    currentList.push({ id: s.id, window });
  });

  const reservations = reservationsRaw.map((line, i) => {
    const fields = line.split("|");
    if (fields.length !== 5) {
      throw new Error(
        makeFileError(RESERVATIONS_FILE, i + 1, "필드 개수가 올바르지 않습니다. (reservationId|phone|screeningId|seatRow|seatCol)")
      );
    }

    const [id, phone, screeningId, seatRowRaw, seatColRaw] = fields;
    const seatRow = String(seatRowRaw).toUpperCase();
    const seatCol = Number(seatColRaw);

    if (!validateCompatibleReservationCode(id)) {
      throw new Error(makeFileError(RESERVATIONS_FILE, i + 1, `reservationId(${id}) 형식이 올바르지 않습니다.`));
    }

    if (!validatePhoneSyntax(phone)) {
      throw new Error(makeFileError(RESERVATIONS_FILE, i + 1, `전화번호(${phone}) 형식이 올바르지 않습니다.`));
    }

    if (!screeningIdSet.has(screeningId)) {
      throw new Error(makeFileError(RESERVATIONS_FILE, i + 1, `존재하지 않는 screeningId(${screeningId}) 참조`));
    }

    const composedSeat = `${seatRow}${String(seatCol).padStart(2, "0")}`;
    if (!validateSeatSyntax(composedSeat)) {
      throw new Error(makeFileError(RESERVATIONS_FILE, i + 1, `좌석(${seatRow}${seatColRaw}) 형식이 올바르지 않습니다.`));
    }

    const screening = screenings.find((s) => s.id === screeningId);
    if (!validateSeatSemantic(screening, { row: seatRow, col: seatCol })) {
      throw new Error(makeFileError(RESERVATIONS_FILE, i + 1, `존재하지 않는 좌석(${seatRow}${seatColRaw})입니다.`));
    }

    return { id, phone, screeningId, seatRow, seatCol };
  });

  const reservedSeatSet = new Set();
  for (let i = 0; i < reservations.length; i++) {
    const r = reservations[i];
    const seatKey = `${r.screeningId}|${r.seatRow}|${r.seatCol}`;
    if (reservedSeatSet.has(seatKey)) {
      throw new Error(makeFileError(RESERVATIONS_FILE, i + 1, "이미 예약된 좌석이 중복 저장되어 있음"));
    }
    reservedSeatSet.add(seatKey);
  }

  return { movies, screenings, reservations };
}

function generateReservationId(reservations) {
  // TODO: 명세는 0001 형식을 요구하지만, 현재 샘플 파일 호환을 위해 R1, R2... 형식을 유지한다.
  const maxNum = reservations.reduce((max, r) => {
    const match = r.id.match(/^R(\d+)$/);
    if (!match) return max;
    const num = Number(match[1]);
    return num > max ? num : max;
  }, 0);
  return `R${maxNum + 1}`;
}

function printMainMenu() {
  console.log("\n==============================");
  console.log("영화 예매 시스템");
  console.log("==============================");
  console.log("1. 영화 예매");
  console.log("2. 예매 내역 조회");
  console.log("3. 종료");
  console.log("==============================");
}

function printMovies(movies) {
  console.log("\n[영화 목록]");
  movies.forEach((movie, index) => {
    console.log(`${index + 1}. ${movie.title} (${movie.id})`);
  });
}

function printScreenings(screenings, movies) {
  console.log("\n[상영 정보]");
  screenings.forEach((s, index) => {
    console.log(
      `${index + 1}. ${getMovieTitle(s.movieId, movies)} | ${s.theater} | ${s.date} | ${s.time} | ${s.rows}x${s.cols}`
    );
  });
}

function displaySeats(screening, reservations) {
  const reservedSeats = reservations.filter((r) => r.screeningId === screening.id);
  console.log("\n[좌석 배치도]");

  process.stdout.write("    ");
  for (let c = 1; c <= screening.cols; c++) {
    process.stdout.write(`${c} `);
  }
  console.log();

  for (let r = 0; r < screening.rows; r++) {
    const rowChar = String.fromCharCode(65 + r);
    process.stdout.write(`${rowChar} | `);

    for (let c = 1; c <= screening.cols; c++) {
      const isReserved = reservedSeats.some((seat) => seat.seatRow === rowChar && seat.seatCol === c);
      process.stdout.write(isReserved ? "X " : "O ");
    }
    console.log();
  }

  console.log("O: 예약 가능, X: 예약됨");
}

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
    const movieScreenings = state.screenings.filter((s) => s.movieId === movie.id);
    if (movieScreenings.length === 0) {
      console.log("선택한 영화에 해당하는 상영 정보가 없습니다. back/main/help/quit 또는 올바른 값을 입력하세요.");
      continue;
    }

    return movie;
  }
}

function buildDateFilteredScreenings(screenings, selectedDate) {
  if (!selectedDate) return screenings;
  return screenings.filter((s) => s.date === selectedDate);
}

async function selectDateStep(movieScreenings) {
  // 추후 날짜 선택 단계 확장용 함수. 현재는 "all" 입력 시 전체 날짜를 허용하는 호환 구조.
  const dates = [...new Set(movieScreenings.map((s) => s.date))].sort();

  console.log("\n[상영 날짜]");
  dates.forEach((d, i) => console.log(`${i + 1}. ${d}`));
  console.log(`${dates.length + 1}. 전체 날짜`);

  while (true) {
    const input = await askInput("상영 날짜 번호를 선택하세요(또는 전체는 마지막 번호): ");
    if (isControl(input)) return input;

    const idx = Number(input);
    if (!Number.isInteger(idx) || idx < 1 || idx > dates.length + 1) {
      console.log("올바른 날짜 번호를 입력하세요.");
      continue;
    }

    if (idx === dates.length + 1) {
      return null;
    }

    return dates[idx - 1];
  }
}

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

function hasTimeConflict(phone, selectedScreening, reservations, screenings) {
  return reservations.some((r) => {
    if (!samePhone(r.phone, phone)) return false;
    const reservedScreening = getScreeningById(r.screeningId, screenings);
    if (!reservedScreening) return false;

    return reservedScreening.date === selectedScreening.date && reservedScreening.time === selectedScreening.time;
  });
}

async function inputPhoneStep(state, selectedScreening) {
  while (true) {
    const input = await askInput("전화번호를 입력하세요: ");
    if (isControl(input)) return input;

    if (!validatePhoneSyntax(input)) {
      console.log("전화번호 형식이 올바르지 않습니다.");
      continue;
    }

    if (hasTimeConflict(input, selectedScreening, state.reservations, state.screenings)) {
      console.log("같은 시간대에 이미 예매한 내역이 있습니다.");
      continue;
    }

    return input;
  }
}

function isSeatReserved(screeningId, seat, reservations) {
  return reservations.some((r) => r.screeningId === screeningId && r.seatRow === seat.row && r.seatCol === seat.col);
}

async function selectSeatStep(state, selectedScreening) {
  while (true) {
    displaySeats(selectedScreening, state.reservations);

    const input = await askInput("좌석을 입력하세요 (예: A1 또는 A01): ");
    if (isControl(input)) return input;

    const normalizedInput = input.toUpperCase();
    const paddedInput = normalizedInput[0] + normalizedInput.slice(1).padStart(2, "0");

    if (!validateSeatSyntax(paddedInput)) {
      console.log("좌석 입력 형식이 올바르지 않습니다. 예: A1, A01");
      continue;
    }

    const seat = normalizeSeat(normalizedInput);
    if (!validateSeatSemantic(selectedScreening, seat)) {
      console.log("존재하지 않는 좌석입니다. 다시 선택하세요.");
      continue;
    }

    if (isSeatReserved(selectedScreening.id, seat, state.reservations)) {
      console.log("이미 예약된 좌석입니다. 다시 선택하세요.");
      continue;
    }

    return seat;
  }
}

async function confirmReservationStep(selectedMovie, selectedScreening, phone, seat) {
  console.log("\n[예매 확인]");
  console.log(`영화: ${selectedMovie.title}`);
  console.log(`상영관: ${selectedScreening.theater}`);
  console.log(`날짜: ${selectedScreening.date}`);
  console.log(`시간: ${selectedScreening.time}`);
  console.log(`좌석: ${seat.row}${seat.col}`);
  console.log(`전화번호: ${phone}`);

  while (true) {
    const input = await askInput("예매를 확정하시겠습니까? (y/n 또는 yes/no): ");
    if (isControl(input)) return input;

    const lowered = input.toLowerCase();
    if (["y", "yes"].includes(lowered)) return true;
    if (["n", "no"].includes(lowered)) return false;

    console.log("y/n 또는 yes/no를 입력하세요.");
  }
}

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
    (r) => `${r.id}|${r.phone}|${r.screeningId}|${r.seatRow}|${r.seatCol}`
  );
  writeLines(RESERVATIONS_FILE, lines);
}

async function reserveMovieFlow(state) {
  const selectedMovie = await selectMovieStep(state);
  if (isControl(selectedMovie)) return selectedMovie;

  const movieScreenings = state.screenings.filter((s) => s.movieId === selectedMovie.id);

  const selectedDate = await selectDateStep(movieScreenings);
  if (isControl(selectedDate)) {
    if (selectedDate.command === CMD.BACK) return undefined;
    return selectedDate;
  }

  const filteredScreenings = buildDateFilteredScreenings(movieScreenings, selectedDate);
  if (filteredScreenings.length === 0) {
    console.log("선택한 날짜의 상영 정보가 없습니다.");
    return undefined;
  }

  const selectedScreening = await selectScreeningStep(filteredScreenings, state.movies);
  if (isControl(selectedScreening)) {
    if (selectedScreening.command === CMD.BACK) return undefined;
    return selectedScreening;
  }

  const phone = await inputPhoneStep(state, selectedScreening);
  if (isControl(phone)) {
    if (phone.command === CMD.BACK) return undefined;
    return phone;
  }

  const seat = await selectSeatStep(state, selectedScreening);
  if (isControl(seat)) {
    if (seat.command === CMD.BACK) return undefined;
    return seat;
  }

  const confirmed = await confirmReservationStep(selectedMovie, selectedScreening, phone, seat);
  if (isControl(confirmed)) {
    if (confirmed.command === CMD.BACK) return undefined;
    return confirmed;
  }

  if (!confirmed) {
    console.log("예매가 취소되었습니다.");
    return undefined;
  }

  saveReservation(state, phone, selectedScreening.id, seat);
  console.log("예매가 완료되었습니다.");
  return undefined;
}

async function lookupReservationFlow(state) {
  while (true) {
    const input = await askInput("조회할 전화번호를 입력하세요: ");
    if (isControl(input)) return input;

    if (!validatePhoneSyntax(input)) {
      console.log("전화번호 형식이 올바르지 않습니다.");
      continue;
    }

    const myReservations = state.reservations.filter((r) => samePhone(r.phone, input));

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
        `${index + 1}. 영화: ${movieTitle} | 상영관: ${screening.theater} | 날짜: ${screening.date} | 시간: ${screening.time} | 좌석: ${r.seatRow}${r.seatCol} | 예약번호: ${r.id}`
      );
    });
    return undefined;
  }
}

async function main() {
  ensureFileExists(MOVIES_FILE);
  ensureFileExists(SCREENINGS_FILE);
  ensureFileExists(RESERVATIONS_FILE);

  let state;
  try {
    state = parseAndValidateFiles();
  } catch (error) {
    console.error(error.message);
    rl.close();
    return;
  }

  while (true) {
    printMainMenu();
    const choice = await askInput("명령(help, quit, back, main) 또는 메뉴 번호를 입력하세요: ", {
      allowBack: false,
      allowMain: false,
    });

    if (isControl(choice)) {
      continue;
    }

    switch (choice) {
      case "1": {
        const control = await reserveMovieFlow(state);
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
        safeExit();
        return;
      default:
        console.log("올바른 메뉴 번호를 입력하세요.");
    }
  }
}

main();
