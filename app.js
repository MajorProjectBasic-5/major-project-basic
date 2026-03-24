const fs = require("fs");
const readline = require("readline");

const MOVIES_FILE = "movies.txt";
const SCREENINGS_FILE = "screenings.txt";
const RESERVATIONS_FILE = "reservations.txt";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

function ensureFileExists(fileName) {
  if (!fs.existsSync(fileName)) {
    fs.writeFileSync(fileName, "", "utf8");
  }
}

function readLines(fileName) {
  ensureFileExists(fileName);
  const content = fs.readFileSync(fileName, "utf8").trim();
  if (!content) return [];
  return content.split("\n").map((line) => line.trim()).filter(Boolean);
}

function writeLines(fileName, lines) {
  fs.writeFileSync(fileName, lines.join("\n"), "utf8");
}

function parseMovies() {
  // 형식: movieId|title
  return readLines(MOVIES_FILE).map((line) => {
    const [id, title] = line.split("|");
    return { id, title };
  });
}

function parseScreenings() {
  // 형식: screeningId|movieId|theater|date|time|rows|cols
  return readLines(SCREENINGS_FILE).map((line) => {
    const [id, movieId, theater, date, time, rows, cols] = line.split("|");
    return {
      id,
      movieId,
      theater,
      date,
      time,
      rows: Number(rows),
      cols: Number(cols),
    };
  });
}

function parseReservations() {
  // 형식: reservationId|phone|screeningId|seatRow|seatCol
  return readLines(RESERVATIONS_FILE).map((line) => {
    const [id, phone, screeningId, seatRow, seatCol] = line.split("|");
    return {
      id,
      phone,
      screeningId,
      seatRow,
      seatCol: Number(seatCol),
    };
  });
}

function generateReservationId(reservations) {
  if (reservations.length === 0) return "R1";
  const maxNum = reservations.reduce((max, r) => {
    const num = Number(r.id.replace("R", ""));
    return num > max ? num : max;
  }, 0);
  return `R${maxNum + 1}`;
}

function getMovieTitle(movieId, movies) {
  const movie = movies.find((m) => m.id === movieId);
  return movie ? movie.title : "알 수 없는 영화";
}

function getScreeningById(screeningId, screenings) {
  return screenings.find((s) => s.id === screeningId);
}

function printMainMenu() {
  console.log("\n==============================");
  console.log("   영화 예매 시스템");
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

function printScreenings(screenings, movies, movieId) {
  const filtered = screenings.filter((s) => s.movieId === movieId);

  console.log("\n[상영 정보]");
  filtered.forEach((s, index) => {
    console.log(
      `${index + 1}. ${getMovieTitle(s.movieId, movies)} | 상영관: ${s.theater} | 날짜: ${s.date} | 시간: ${s.time} | 좌석: ${s.rows}x${s.cols}`
    );
  });

  return filtered;
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
    const rowChar = String.fromCharCode(65 + r); // A, B, C...
    process.stdout.write(`${rowChar} | `);

    for (let c = 1; c <= screening.cols; c++) {
      const isReserved = reservedSeats.some(
        (seat) => seat.seatRow === rowChar && seat.seatCol === c
      );
      process.stdout.write(isReserved ? "X " : "O ");
    }
    console.log();
  }

  console.log("O: 예약 가능, X: 예약됨");
}

function isValidSeat(screening, seatRow, seatCol) {
  const rowIndex = seatRow.charCodeAt(0) - 65;
  return (
    rowIndex >= 0 &&
    rowIndex < screening.rows &&
    seatCol >= 1 &&
    seatCol <= screening.cols
  );
}

function isSeatReserved(screeningId, seatRow, seatCol, reservations) {
  return reservations.some(
    (r) =>
      r.screeningId === screeningId &&
      r.seatRow === seatRow &&
      r.seatCol === seatCol
  );
}

function hasTimeConflict(phone, selectedScreening, reservations, screenings) {
  const myReservations = reservations.filter((r) => r.phone === phone);

  return myReservations.some((r) => {
    const reservedScreening = getScreeningById(r.screeningId, screenings);
    if (!reservedScreening) return false;

    return (
      reservedScreening.date === selectedScreening.date &&
      reservedScreening.time === selectedScreening.time
    );
  });
}

async function reserveMovie() {
  const movies = parseMovies();
  const screenings = parseScreenings();
  const reservations = parseReservations();

  if (movies.length === 0 || screenings.length === 0) {
    console.log("영화 또는 상영 정보가 없습니다.");
    return;
  }

  printMovies(movies);

  let movieIndex;
  while (true) {
    movieIndex = Number(await ask("영화 번호를 선택하세요: "));
    if (movieIndex >= 1 && movieIndex <= movies.length) break;
    console.log("올바른 영화 번호를 입력하세요.");
  }

  const selectedMovie = movies[movieIndex - 1];
  const availableScreenings = printScreenings(screenings, movies, selectedMovie.id);

  if (availableScreenings.length === 0) {
    console.log("선택한 영화의 상영 정보가 없습니다.");
    return;
  }

  let screeningIndex;
  while (true) {
    screeningIndex = Number(await ask("상영 번호를 선택하세요: "));
    if (screeningIndex >= 1 && screeningIndex <= availableScreenings.length) break;
    console.log("올바른 상영 번호를 입력하세요.");
  }

  const selectedScreening = availableScreenings[screeningIndex - 1];
  const phone = await ask("전화번호를 입력하세요: ");

  if (hasTimeConflict(phone, selectedScreening, reservations, screenings)) {
    console.log("같은 시간대에 이미 다른 예매가 있습니다. 예매할 수 없습니다.");
    return;
  }

  while (true) {
    displaySeats(selectedScreening, reservations);

    let seatInput = await ask("좌석을 입력하세요 (예: A1): ");
    seatInput = seatInput.toUpperCase();

    const match = seatInput.match(/^([A-Z])(\d+)$/);
    if (!match) {
      console.log("좌석 입력 형식이 올바르지 않습니다. 예: A1");
      continue;
    }

    const seatRow = match[1];
    const seatCol = Number(match[2]);

    if (!isValidSeat(selectedScreening, seatRow, seatCol)) {
      console.log("존재하지 않는 좌석입니다. 다시 선택하세요.");
      continue;
    }

    if (isSeatReserved(selectedScreening.id, seatRow, seatCol, reservations)) {
      console.log("이미 예약된 좌석입니다. 다시 선택하세요.");
      continue;
    }

    console.log("\n[예매 확인]");
    console.log(`영화: ${selectedMovie.title}`);
    console.log(`상영관: ${selectedScreening.theater}`);
    console.log(`날짜: ${selectedScreening.date}`);
    console.log(`시간: ${selectedScreening.time}`);
    console.log(`좌석: ${seatRow}${seatCol}`);
    console.log(`전화번호: ${phone}`);

    const confirm = (await ask("예매를 확정하시겠습니까? (y/n): ")).toLowerCase();
    if (confirm !== "y") {
      console.log("예매가 취소되었습니다.");
      return;
    }

    const newReservationId = generateReservationId(reservations);
    const line = `${newReservationId}|${phone}|${selectedScreening.id}|${seatRow}|${seatCol}`;
    const currentLines = readLines(RESERVATIONS_FILE);
    currentLines.push(line);
    writeLines(RESERVATIONS_FILE, currentLines);

    console.log("예매가 완료되었습니다.");
    return;
  }
}

async function lookupReservation() {
  const movies = parseMovies();
  const screenings = parseScreenings();
  const reservations = parseReservations();

  const phone = await ask("조회할 전화번호를 입력하세요: ");
  const myReservations = reservations.filter((r) => r.phone === phone);

  if (myReservations.length === 0) {
    console.log("해당 전화번호로 예매된 내역이 없습니다.");
    return;
  }

  console.log("\n[예매 내역 조회]");
  myReservations.forEach((r, index) => {
    const screening = getScreeningById(r.screeningId, screenings);
    if (!screening) {
      console.log(`${index + 1}. 잘못된 상영 정보`);
      return;
    }

    const movieTitle = getMovieTitle(screening.movieId, movies);

    console.log(
      `${index + 1}. 영화: ${movieTitle} | 상영관: ${screening.theater} | 날짜: ${screening.date} | 시간: ${screening.time} | 좌석: ${r.seatRow}${r.seatCol} | 예약번호: ${r.id}`
    );
  });
}

async function main() {
  ensureFileExists(MOVIES_FILE);
  ensureFileExists(SCREENINGS_FILE);
  ensureFileExists(RESERVATIONS_FILE);

  while (true) {
    printMainMenu();
    const choice = await ask("메뉴를 선택하세요: ");

    switch (choice) {
      case "1":
        await reserveMovie();
        break;
      case "2":
        await lookupReservation();
        break;
      case "3":
        console.log("프로그램을 종료합니다.");
        rl.close();
        return;
      default:
        console.log("올바른 메뉴 번호를 입력하세요.");
    }
  }
}

main();