import { useEffect, useMemo, useState } from "react";
import "./App.css";

const COMPETITIONS = [
  { code: "PL", name: "Premier League", short: "PL" },
  { code: "ELC", name: "Championship", short: "CH" },
  { code: "CL", name: "UEFA Champions League", short: "UCL" },
];

const STORAGE_KEY = "footballverse-universe-v4";
const HISTORY_KEY = "footballverse-title-history";
const SEASON = "2026/27";

function emptyUniverse() {
  return { PL: null, ELC: null, CL: null };
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function makeMatch(home, away, id) {
  return {
    id,
    home: home.name,
    away: away.name,
    homeId: home.id,
    awayId: away.id,
    homeCrest: home.crest || "",
    awayCrest: away.crest || "",
    homeScore: "",
    awayScore: "",
    played: false,
  };
}

function domesticFixtures(teams) {
  const list = [...teams];
  if (list.length % 2) list.push({ id: "bye", name: "BYE" });

  const rounds = [];
  const count = list.length;
  let rotation = [...list];

  for (let round = 0; round < count - 1; round++) {
    const matches = [];
    for (let i = 0; i < count / 2; i++) {
      const a = rotation[i];
      const b = rotation[count - 1 - i];
      if (a.id !== "bye" && b.id !== "bye") {
        const home = round % 2 === 0 ? a : b;
        const away = round % 2 === 0 ? b : a;
        matches.push(makeMatch(home, away, `r${round}-m${i}`));
      }
    }
    rounds.push(matches);
    rotation = [rotation[0], rotation[count - 1], ...rotation.slice(1, count - 1)];
  }

  const reverse = rounds.map((round, index) =>
    round.map((match, i) => ({
      ...match,
      id: `rr${index}-m${i}`,
      home: match.away,
      away: match.home,
      homeId: match.awayId,
      awayId: match.homeId,
      homeCrest: match.awayCrest,
      awayCrest: match.homeCrest,
      homeScore: "",
      awayScore: "",
      played: false,
    }))
  );

  return [...rounds, ...reverse].map((matches, index) => ({
    number: index + 1,
    matches,
  }));
}

function championsLeagueFixtures(teams) {
  const list = shuffle(teams);
  if (list.length < 2) return [];

  const rounds = [];
  const count = list.length;
  let rotation = [...list];

  for (let round = 0; round < 8; round++) {
    const matches = [];
    const used = new Set();

    for (let i = 0; i < count / 2; i++) {
      const a = rotation[i];
      const b = rotation[count - 1 - i];
      if (!a || !b || used.has(a.id) || used.has(b.id)) continue;
      used.add(a.id);
      used.add(b.id);
      const home = (round + i) % 2 === 0 ? a : b;
      const away = home.id === a.id ? b : a;
      matches.push(makeMatch(home, away, `cl-${round}-${i}`));
    }

    rounds.push({ number: round + 1, matches });
    rotation = [rotation[0], rotation[count - 1], ...rotation.slice(1, count - 1)];
  }

  return rounds;
}

function createCompetition(code, teams, emblem = "") {
  const competition = COMPETITIONS.find((item) => item.code === code);
  const cleanTeams = teams
    .filter((team) => team.name && team.id !== "bye")
    .map((team, index) => ({ ...team, id: String(team.id ?? index) }));

  return {
    code,
    name: competition?.name ?? code,
    emblem,
    teams: cleanTeams,
    matchdays:
      code === "CL"
        ? championsLeagueFixtures(cleanTeams)
        : domesticFixtures(cleanTeams),
    playoffs: null,
    clKnockout: null,
    champion: null,
  };
}

function calculateTable(competition) {
  if (!competition) return [];

  const stats = new Map(
    competition.teams.map((team) => [
      team.id,
      {
        id: team.id,
        name: team.name,
        crest: team.crest || "",
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        gf: 0,
        ga: 0,
        gd: 0,
        points: 0,
      },
    ])
  );

  for (const day of competition.matchdays) {
    for (const match of day.matches) {
      if (!match.played) continue;
      const home = stats.get(match.homeId);
      const away = stats.get(match.awayId);
      if (!home || !away) continue;

      const hs = Number(match.homeScore);
      const as = Number(match.awayScore);
      home.played++;
      away.played++;
      home.gf += hs;
      home.ga += as;
      away.gf += as;
      away.ga += hs;

      if (hs > as) {
        home.won++;
        away.lost++;
        home.points += 3;
      } else if (hs < as) {
        away.won++;
        home.lost++;
        away.points += 3;
      } else {
        home.drawn++;
        away.drawn++;
        home.points++;
        away.points++;
      }
    }
  }

  return [...stats.values()]
    .map((team) => ({ ...team, gd: team.gf - team.ga }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.gd - a.gd ||
        b.gf - a.gf ||
        a.name.localeCompare(b.name)
    );
}

function markerFor(code, position) {
  if (code === "PL") {
    if (position === 1) {
      return [
        { label: "PL W", kind: "winner" },
        { label: "UCL", kind: "uefa" },
      ];
    }
    if (position <= 4) return [{ label: "UCL", kind: "uefa" }];
    if (position === 5) return [{ label: "UEL", kind: "europa" }];
    if (position === 6) return [{ label: "UECL", kind: "conference" }];
    if (position >= 18) return [{ label: "R", kind: "relegated" }];
  }

  if (code === "ELC") {
    if (position === 1) return [{ label: "CH W", kind: "winner" }, { label: "P", kind: "promotion" }];
    if (position === 2) return [{ label: "P", kind: "promotion" }];
    if (position >= 3 && position <= 4) return [{ label: "PO", kind: "playoff-dark" }];
    if (position >= 5 && position <= 8) return [{ label: "PO", kind: "playoff-light" }];
  }

  if (code === "CL") {
    if (position <= 8) return [{ label: "R16", kind: "uefa" }];
    if (position <= 24) return [{ label: "PO", kind: "playoff-light" }];
    return [{ label: "OUT", kind: "relegated" }];
  }

  return [];
}

function randomScore() {
  return Math.floor(Math.random() * 5);
}

function simulateMatches(matches) {
  return matches.map((match) => ({
    ...match,
    homeScore: randomScore(),
    awayScore: randomScore(),
    played: true,
  }));
}

function winnerOf(match) {
  if (!match) return null;
  const home = Number(match.homeScore);
  const away = Number(match.awayScore);
  if (home > away) return match.home;
  if (away > home) return match.away;
  return Math.random() < 0.5 ? match.home : match.away;
}

function makeTie(a, b, id) {
  return {
    id,
    home: a,
    away: b,
    homeScore: "",
    awayScore: "",
    played: false,
  };
}

function simulateTies(ties) {
  return ties.map((tie) => ({
    ...tie,
    homeScore: randomScore(),
    awayScore: randomScore(),
    played: true,
  }));
}

function makeBracket(teams, prefix = "round") {
  const ties = [];
  for (let i = 0; i < teams.length; i += 2) {
    if (teams[i + 1]) ties.push(makeTie(teams[i], teams[i + 1], `${prefix}-${i / 2}`));
  }
  return ties;
}

function getApiTeams(data) {
  const table = data?.standings?.find((item) => item.type === "TOTAL")?.table;
  if (table?.length) {
    return table.map((row) => ({
      id: String(row.team.id),
      name: row.team.name,
      crest: row.team.crest || "",
    }));
  }

  const groups = data?.standings?.flatMap((item) => item.table ?? []) ?? [];
  if (groups.length) {
    return [...new Map(groups.map((row) => [
      String(row.team.id),
      {
        id: String(row.team.id),
        name: row.team.name,
        crest: row.team.crest || "",
      },
    ])).values()];
  }

  return [];
}

function ClubCrest({ src, name }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (src && !failed) {
    return (
      <img
        className="club-crest"
        src={src}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span className="club-crest-fallback" aria-hidden="true">
      {(name || "FC").slice(0, 2).toUpperCase()}
    </span>
  );
}

function App() {
  const [universe, setUniverse] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? emptyUniverse();
    } catch {
      return emptyUniverse();
    }
  });
  const [activeCode, setActiveCode] = useState("PL");
  const [started, setStarted] = useState(() => {
    try {
      return Object.values(JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {}).some(Boolean);
    } catch {
      return false;
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [collapsed, setCollapsed] = useState({});
  const [resetOpen, setResetOpen] = useState(false);
  const [historyEnabled, setHistoryEnabled] = useState(
    () => localStorage.getItem("footballverse-track-titles") === "yes"
  );
  const [history, setHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY)) ?? [];
    } catch {
      return [];
    }
  });

  const activeCompetition = universe[activeCode];
  const table = useMemo(
    () => calculateTable(activeCompetition),
    [activeCompetition]
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(universe));
  }, [universe]);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    let cancelled = false;

    async function refreshSavedLogos() {
      const codes = COMPETITIONS
        .filter((item) => universe[item.code]?.teams?.length)
        .filter((item) => {
          const competition = universe[item.code];
          return !competition.emblem || competition.teams.some((team) => !team.crest);
        });

      if (!codes.length) return;

      const updates = {};

      for (const item of codes) {
        try {
          const response = await fetch(
            `/api/football-data/competitions/${item.code}/standings`
          );
          if (!response.ok) continue;

          const data = await response.json();
          updates[item.code] = {
            emblem: data.competition?.emblem || "",
            teams: getApiTeams(data),
          };
        } catch {
          // Keep saved competitions working if logo refresh fails.
        }
      }

      if (cancelled || !Object.keys(updates).length) return;

      setUniverse((current) => {
        const next = { ...current };

        for (const [code, update] of Object.entries(updates)) {
          const competition = next[code];
          if (!competition) continue;

          const crestById = new Map(
            update.teams.map((team) => [team.id, team.crest])
          );

          const teams = competition.teams.map((team) => ({
            ...team,
            crest: team.crest || crestById.get(team.id) || "",
          }));

          next[code] = {
            ...competition,
            emblem: competition.emblem || update.emblem,
            teams,
            matchdays: competition.matchdays.map((day) => ({
              ...day,
              matches: day.matches.map((match) => ({
                ...match,
                homeCrest: match.homeCrest || crestById.get(match.homeId) || "",
                awayCrest: match.awayCrest || crestById.get(match.awayId) || "",
              })),
            })),
          };
        }

        return next;
      });
    }

    refreshSavedLogos();

    return () => {
      cancelled = true;
    };
  }, []);

  const updateCompetition = (code, updater) => {
    setUniverse((current) => ({
      ...current,
      [code]: updater(current[code]),
    }));
  };

  async function startUniverse() {
    setLoading(true);
    setError("");

    try {
      const next = { ...universe };

      for (const competition of COMPETITIONS) {
        if (next[competition.code]) continue;

        const response = await fetch(
          `/api/football-data/competitions/${competition.code}/standings`
        );
        if (!response.ok) {
          throw new Error(
            `${competition.name} could not load. Check your API plan or connection.`
          );
        }

        const data = await response.json();
        const teams = getApiTeams(data);

        if (teams.length < 2) {
          throw new Error(`No teams were returned for ${competition.name}.`);
        }

        next[competition.code] = createCompetition(
          competition.code,
          teams,
          data.competition?.emblem || ""
        );
      }

      setUniverse(next);
      setStarted(true);
    } catch (err) {
      setError(err.message || "Something went wrong while loading the leagues.");
    } finally {
      setLoading(false);
    }
  }

  function updateScore(matchId, side, value) {
    const score = value === "" ? "" : Math.max(0, Math.min(10, Number(value) || 0));
    updateCompetition(activeCode, (competition) => ({
      ...competition,
      matchdays: competition.matchdays.map((day) => ({
        ...day,
        matches: day.matches.map((match) =>
          match.id === matchId
            ? {
                ...match,
                [side]: score,
                played:
                  (side === "homeScore" ? score : match.homeScore) !== "" &&
                  (side === "awayScore" ? score : match.awayScore) !== "",
              }
            : match
        ),
      })),
    }));
  }

  function simulateMatchday(dayNumber) {
    updateCompetition(activeCode, (competition) => ({
      ...competition,
      matchdays: competition.matchdays.map((day) =>
        day.number === dayNumber
          ? { ...day, matches: simulateMatches(day.matches) }
          : day
      ),
    }));
  }

  function simulateRemaining() {
    updateCompetition(activeCode, (competition) => ({
      ...competition,
      matchdays: competition.matchdays.map((day) => ({
        ...day,
        matches: day.matches.map((match) =>
          match.played ? match : simulateMatches([match])[0]
        ),
      })),
    }));
  }

  function simulateDomesticPlayoffs() {
    const ranked = calculateTable(universe.ELC);
    if (ranked.length < 8) return;

    const teams = ranked.slice(2, 8).map((team) => team.name);
    const firstRound = [
      makeTie(teams[0], teams[5], "semi-1"),
      makeTie(teams[1], teams[4], "semi-2"),
      makeTie(teams[2], teams[3], "semi-3"),
    ];

    updateCompetition("ELC", (competition) => ({
      ...competition,
      playoffs: {
        semifinals: simulateTies(firstRound),
        final: null,
        champion: null,
      },
    }));
  }

  function advanceDomesticPlayoffs() {
    const playoffs = universe.ELC?.playoffs;
    if (!playoffs?.semifinals) return;
    const finalists = playoffs.semifinals.map(winnerOf);
    const final = simulateTies([makeTie(finalists[0], finalists[1], "playoff-final")]);

    updateCompetition("ELC", (competition) => ({
      ...competition,
      playoffs: {
        ...competition.playoffs,
        final,
        champion: winnerOf(final[0]),
      },
    }));
  }

  function startChampionsLeagueKnockouts() {
    const ranked = calculateTable(universe.CL);
    if (ranked.length < 24) return;

    const direct = ranked.slice(0, 8).map((team) => team.name);
    const playoffTeams = ranked.slice(8, 24).map((team) => team.name);
    const playoffTies = [];

    for (let i = 0; i < 8; i++) {
      playoffTies.push(makeTie(playoffTeams[i], playoffTeams[15 - i], `clpo-${i}`));
    }

    updateCompetition("CL", (competition) => ({
      ...competition,
      clKnockout: {
        direct,
        playoffs: simulateTies(playoffTies),
        roundOf16: null,
        quarterFinals: null,
        semiFinals: null,
        final: null,
        champion: null,
      },
    }));
  }

  function advanceChampionsLeague(stage) {
    const knockout = universe.CL?.clKnockout;
    if (!knockout) return;

    let updated = { ...knockout };

    if (stage === "playoffs") {
      const winners = knockout.playoffs.map(winnerOf);
      const round = [];
      for (let i = 0; i < 8; i++) {
        round.push(makeTie(knockout.direct[i], winners[7 - i], `r16-${i}`));
      }
      updated.roundOf16 = simulateTies(round);
    } else if (stage === "roundOf16" && knockout.roundOf16) {
      const winners = knockout.roundOf16.map(winnerOf);
      updated.quarterFinals = simulateTies(makeBracket(winners, "qf"));
    } else if (stage === "quarterFinals" && knockout.quarterFinals) {
      const winners = knockout.quarterFinals.map(winnerOf);
      updated.semiFinals = simulateTies(makeBracket(winners, "sf"));
    } else if (stage === "semiFinals" && knockout.semiFinals) {
      const winners = knockout.semiFinals.map(winnerOf);
      updated.final = simulateTies(makeBracket(winners, "final"));
      updated.champion = winnerOf(updated.final[0]);
    }

    updateCompetition("CL", (competition) => ({
      ...competition,
      clKnockout: updated,
    }));
  }

  function recordTitles() {
    const winners = [];
    for (const code of ["PL", "ELC", "CL"]) {
      const competition = universe[code];
      if (!competition) continue;

      let winner = null;
      if (code === "CL") winner = competition.clKnockout?.champion;
      else if (code === "ELC") winner = competition.playoffs?.champion || calculateTable(competition)[0]?.name;
      else winner = calculateTable(competition)[0]?.name;

      if (winner) winners.push({ competition: code, winner, season: SEASON });
    }

    if (!winners.length) return;
    setHistory((current) => {
      const withoutCurrent = current.filter(
        (item) => !(item.season === SEASON && winners.some((w) => w.competition === item.competition))
      );
      return [...withoutCurrent, ...winners];
    });
  }

  function resetUniverse() {
    localStorage.removeItem(STORAGE_KEY);
    setUniverse(emptyUniverse());
    setStarted(false);
    setActiveCode("PL");
    setResetOpen(false);
    setCollapsed({});
  }

  function toggleDay(number) {
    setCollapsed((current) => ({ ...current, [number]: !current[number] }));
  }

  if (!started) {
    return (
      <main className="welcome-screen">
        <div className="welcome-panel">
          <div className="welcome-kicker">YOUR FOOTBALL WORLD</div>
          <h1>Build your <span>Footballverse.</span></h1>
          <p>
            Take control of the leagues. Simulate matchdays, shape the tables
            and decide who lifts the trophies.
          </p>
          {error && <div className="error-message">{error}</div>}
          <button className="primary-button start-button" onClick={startUniverse} disabled={loading}>
            {loading ? "Loading competitions..." : "Get started"}
          </button>
          <div className="welcome-footnote">SEASON {SEASON}</div>
        </div>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <style>{`
        .table-tag.uefa {
          background: rgba(65, 135, 245, 0.2);
          color: #65a5ff;
        }

        .table-tag.europa {
          background: rgba(245, 165, 45, 0.2);
          color: #ffb84d;
        }

        .table-tag.conference {
          background: rgba(65, 190, 115, 0.18);
          color: #55d18b;
        }

        .table-tag.relegated {
          background: rgba(230, 65, 75, 0.2);
          color: #ff626b;
        }

        .table-tag.promotion,
        .table-tag.winner {
          background: rgba(65, 190, 115, 0.2);
          color: #55d18b;
        }

        .table-tag.playoff-dark,
        .table-tag.playoff-light {
          background: rgba(125, 210, 145, 0.2);
          color: #91dfa4;
        }

        .promotion-row {
          background: rgba(65, 190, 115, 0.16);
        }

        .playoff-row {
          background: rgba(125, 210, 145, 0.09);
        }

        .relegation-row {
          background: rgba(230, 65, 75, 0.07);
        }

        .relegation-position {
          color: #ff626b !important;
          font-weight: 800;
        }

        .legend-dot.orange {
          background: #ffb84d;
        }

        .legend-dot.conference {
          background: #55d18b;
        }
      `}</style>

      <aside className="sidebar">
        <div className="sidebar-heading">COMPETITIONS</div>
        <nav className="competition-nav">
          {COMPETITIONS.map((competition) => (
            <button
              key={competition.code}
              className={`competition-link ${activeCode === competition.code ? "active" : ""}`}
              onClick={() => setActiveCode(competition.code)}
            >
              <span className={`competition-symbol ${competition.code.toLowerCase()}`}>
                {universe[competition.code]?.emblem ? (
                  <img
                    className="competition-logo"
                    src={universe[competition.code].emblem}
                    alt=""
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  competition.short
                )}
              </span>
              <span>{competition.name}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-season">FOOTBALLVERSE · {SEASON}</div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <div className="eyebrow">COMPETITION CENTRE</div>
            <h1>{activeCompetition?.name || "Footballverse"}</h1>
          </div>
          <div className="topbar-actions">
            <span className="season-label">{SEASON}</span>
            <button className="reset-button" onClick={() => setResetOpen(true)}>
              Reset universe
            </button>
          </div>
        </header>

        {!activeCompetition ? (
          <div className="empty-state">Competition data is not available.</div>
        ) : (
          <>
            <section className="overview-strip">
              <div className="overview-item">
                <span>TEAMS</span>
                <strong>{activeCompetition.teams.length}</strong>
              </div>
              <div className="overview-item">
                <span>MATCHDAYS</span>
                <strong>{activeCompetition.matchdays.length}</strong>
              </div>
              <div className="overview-item">
                <span>PLAYED</span>
                <strong>
                  {activeCompetition.matchdays.reduce(
                    (sum, day) => sum + day.matches.filter((match) => match.played).length,
                    0
                  )}
                </strong>
              </div>
              <div className="overview-actions">
                <button className="secondary-button" onClick={simulateRemaining}>
                  Simulate remaining
                </button>
              </div>
            </section>

            <div className="content-grid">
              <section className="fixtures-section">
                <div className="section-heading">
                  <div>
                    <div className="eyebrow">THE SEASON</div>
                    <h2>{activeCode === "CL" ? "League phase" : "Fixtures & results"}</h2>
                  </div>
                </div>

                <div className="matchday-list">
                  {activeCompetition.matchdays.map((day) => {
                    const isCollapsed = !!collapsed[`${activeCode}-${day.number}`];
                    const played = day.matches.filter((match) => match.played).length;

                    return (
                      <article className="matchday-card" key={`${activeCode}-${day.number}`}>
                        <div className="matchday-header">
                          <button
                            className="matchday-toggle"
                            onClick={() => toggleDay(`${activeCode}-${day.number}`)}
                          >
                            <span className={`chevron ${isCollapsed ? "" : "open"}`}>›</span>
                            <span className="matchday-title">
                              {activeCode === "CL" ? `League matchday ${day.number}` : `Matchday ${day.number}`}
                            </span>
                            <span className="matchday-count">{played}/{day.matches.length} played</span>
                          </button>
                          <button
                            className="simulate-button"
                            onClick={() => simulateMatchday(day.number)}
                          >
                            Simulate
                          </button>
                        </div>

                        {!isCollapsed && (
                          <div className="matches-list">
                            {day.matches.map((match) => (
                              <div className="match-row" key={match.id}>
                                <span className="team-name home-team">
                                  <ClubCrest src={match.homeCrest} name={match.home} />
                                  <span>{match.home}</span>
                                </span>
                                <div className="score-inputs">
                                  <input
                                    aria-label={`${match.home} score`}
                                    type="number"
                                    min="0"
                                    max="10"
                                    value={match.homeScore}
                                    className={match.homeScore === "" ? "unanswered" : ""}
                                    onChange={(event) => updateScore(match.id, "homeScore", event.target.value)}
                                  />
                                  <span className="score-divider">:</span>
                                  <input
                                    aria-label={`${match.away} score`}
                                    type="number"
                                    min="0"
                                    max="10"
                                    value={match.awayScore}
                                    className={match.awayScore === "" ? "unanswered" : ""}
                                    onChange={(event) => updateScore(match.id, "awayScore", event.target.value)}
                                  />
                                </div>
                                <span className="team-name away-team">
                                  <ClubCrest src={match.awayCrest} name={match.away} />
                                  <span>{match.away}</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>

                {activeCode === "ELC" && (
                  <section className="knockout-card">
                    <div className="section-heading">
                      <div>
                        <div className="eyebrow">PROMOTION RACE</div>
                        <h2>Championship playoffs</h2>
                        <p className="section-description">Positions 3–8 compete for the final promotion place.</p>
                      </div>
                      <button className="primary-button" onClick={simulateDomesticPlayoffs}>
                        Simulate playoffs
                      </button>
                    </div>
                    {activeCompetition.playoffs ? (
                      <div className="bracket-grid">
                        <BracketRound title="Semi-finals" ties={activeCompetition.playoffs.semifinals} />
                        {activeCompetition.playoffs.final && (
                          <BracketRound title="Final" ties={activeCompetition.playoffs.final} />
                        )}
                        {activeCompetition.playoffs.champion && (
                          <div className="champion-banner">
                            <span>PLAYOFF WINNER</span>
                            <strong>{activeCompetition.playoffs.champion}</strong>
                          </div>
                        )}
                        {!activeCompetition.playoffs.final && (
                          <button className="secondary-button" onClick={advanceDomesticPlayoffs}>
                            Simulate final
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="muted-copy">Simulate the playoffs when you're ready to decide promotion.</p>
                    )}
                  </section>
                )}

                {activeCode === "CL" && (
                  <section className="knockout-card">
                    <div className="section-heading">
                      <div>
                        <div className="eyebrow">KNOCKOUT STAGE</div>
                        <h2>Champions League bracket</h2>
                        <p className="section-description">
                          Top 8 qualify directly. Places 9–24 enter the knockout playoffs.
                        </p>
                      </div>
                      {!activeCompetition.clKnockout && (
                        <button className="primary-button" onClick={startChampionsLeagueKnockouts}>
                          Create bracket
                        </button>
                      )}
                    </div>

                    {activeCompetition.clKnockout ? (
                      <div className="bracket-grid cl-bracket">
                        <BracketRound title="Knockout playoffs" ties={activeCompetition.clKnockout.playoffs} />
                        {activeCompetition.clKnockout.roundOf16 && (
                          <BracketRound title="Round of 16" ties={activeCompetition.clKnockout.roundOf16} />
                        )}
                        {activeCompetition.clKnockout.quarterFinals && (
                          <BracketRound title="Quarter-finals" ties={activeCompetition.clKnockout.quarterFinals} />
                        )}
                        {activeCompetition.clKnockout.semiFinals && (
                          <BracketRound title="Semi-finals" ties={activeCompetition.clKnockout.semiFinals} />
                        )}
                        {activeCompetition.clKnockout.final && (
                          <BracketRound title="Final" ties={activeCompetition.clKnockout.final} />
                        )}
                        {activeCompetition.clKnockout.champion && (
                          <div className="champion-banner">
                            <span>CHAMPIONS LEAGUE WINNER</span>
                            <strong>{activeCompetition.clKnockout.champion}</strong>
                          </div>
                        )}
                        {!activeCompetition.clKnockout.roundOf16 && (
                          <button className="secondary-button" onClick={() => advanceChampionsLeague("playoffs")}>
                            Simulate round of 16
                          </button>
                        )}
                        {activeCompetition.clKnockout.roundOf16 && !activeCompetition.clKnockout.quarterFinals && (
                          <button className="secondary-button" onClick={() => advanceChampionsLeague("roundOf16")}>
                            Simulate quarter-finals
                          </button>
                        )}
                        {activeCompetition.clKnockout.quarterFinals && !activeCompetition.clKnockout.semiFinals && (
                          <button className="secondary-button" onClick={() => advanceChampionsLeague("quarterFinals")}>
                            Simulate semi-finals
                          </button>
                        )}
                        {activeCompetition.clKnockout.semiFinals && !activeCompetition.clKnockout.final && (
                          <button className="secondary-button" onClick={() => advanceChampionsLeague("semiFinals")}>
                            Simulate final
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="muted-copy">Complete the league phase, then create the knockout bracket.</p>
                    )}
                  </section>
                )}

                <section className="history-panel">
                  <div className="history-title">
                    <div>
                      <div className="eyebrow">HONOURS</div>
                      <h3>Title history</h3>
                    </div>
                    <label className="switch-label">
                      <input
                        type="checkbox"
                        checked={historyEnabled}
                        onChange={(event) => {
                          const enabled = event.target.checked;
                          setHistoryEnabled(enabled);
                          localStorage.setItem("footballverse-track-titles", enabled ? "yes" : "no");
                        }}
                      />
                      <span className="switch-ui" />
                    </label>
                  </div>
                  <p className="history-description">
                    {historyEnabled
                      ? "Title tracking is on. Save this season's winners below."
                      : "Turn on tracking to build a record of your title winners."}
                  </p>
                  {historyEnabled && (
                    <>
                      <button className="secondary-button history-save" onClick={recordTitles}>
                        Save this season's winners
                      </button>
                      <div className="history-list">
                        {["PL", "ELC", "CL"].map((code) => {
                          const counts = history.filter((item) => item.competition === code);
                          const grouped = counts.reduce((acc, item) => {
                            acc[item.winner] = (acc[item.winner] || 0) + 1;
                            return acc;
                          }, {});
                          return (
                            <div className="history-competition" key={code}>
                              <strong>{code}</strong>
                              {Object.keys(grouped).length ? (
                                Object.entries(grouped)
                                  .sort((a, b) => b[1] - a[1])
                                  .map(([name, wins]) => (
                                    <span className="history-winner" key={name}>
                                      {name}<b>{wins}</b>
                                    </span>
                                  ))
                              ) : (
                                <span className="muted-copy">No winners saved yet</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </section>
              </section>

              <aside className="table-panel">
                <div className="table-heading">
                  <div>
                    <div className="eyebrow">LIVE STANDINGS</div>
                    <h2>{activeCode === "CL" ? "League phase table" : "League table"}</h2>
                  </div>
                </div>

                <div className="league-table-wrap">
                  <table className="league-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Club</th>
                        <th>P</th>
                        <th>GD</th>
                        <th>PTS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {table.map((team, index) => {
                        const position = index + 1;
                        const markers = markerFor(activeCode, position);
                        const isRelegated = activeCode === "PL" && position >= 18;
                        const isPromotion = activeCode === "ELC" && position <= 2;
                        const isPlayoff = activeCode === "ELC" && position >= 3 && position <= 8;

                        const rowClass = isRelegated
                          ? "relegation-row"
                          : isPromotion
                            ? "promotion-row"
                            : isPlayoff
                              ? "playoff-row"
                              : "";

                        return (
                          <tr
                            key={team.id}
                            className={rowClass}
                          >
                            <td className={`position-cell ${isRelegated ? "relegation-position" : ""}`}>
                              {position}
                            </td>
                            <td>
                              <div className="club-cell">
                                <ClubCrest src={team.crest} name={team.name} />
                                <span className="club-name">{team.name}</span>
                                <span className="tag-list">
                                  {markers.map((marker) => (
                                    <span className={`table-tag ${marker.kind}`} key={marker.label}>
                                      {marker.label}
                                    </span>
                                  ))}
                                </span>
                              </div>
                            </td>
                            <td>{team.played}</td>
                            <td>{team.gd > 0 ? `+${team.gd}` : team.gd}</td>
                            <td className="points-cell">{team.points}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {activeCode === "PL" ? (
                  <div className="table-legend">
                    <span><i className="legend-dot blue" /> Champions League</span>
                    <span><i className="legend-dot orange" /> Europa League</span>
                    <span><i className="legend-dot conference" /> Conference League</span>
                    <span><i className="legend-dot red" /> Relegation</span>
                  </div>
                ) : (
                  <div className="table-legend">
                    <span><i className="legend-dot blue" /> UEFA places</span>
                    <span><i className="legend-dot red" /> Relegation / out</span>
                    <span><i className="legend-dot green" /> Promotion / winner</span>
                    <span><i className="legend-dot light-green" /> Playoffs</span>
                  </div>
                )}
              </aside>
            </div>
          </>
        )}
      </main>

      {resetOpen && (
        <div className="modal-backdrop">
          <div className="reset-modal">
            <div className="eyebrow">START OVER</div>
            <h2>Reset your universe?</h2>
            <p>This clears your current competitions and results from this browser.</p>
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setResetOpen(false)}>Cancel</button>
              <button className="danger-button" onClick={resetUniverse}>Reset universe</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BracketRound({ title, ties = [] }) {
  return (
    <div className="bracket-round">
      <h3>{title}</h3>
      {ties.map((tie) => (
        <div className="bracket-tie" key={tie.id}>
          <div className={tie.played && Number(tie.homeScore) > Number(tie.awayScore) ? "tie-winner" : ""}>
            <span>{tie.home}</span>
            <b>{tie.played ? tie.homeScore : "–"}</b>
          </div>
          <div className={tie.played && Number(tie.awayScore) > Number(tie.homeScore) ? "tie-winner" : ""}>
            <span>{tie.away}</span>
            <b>{tie.played ? tie.awayScore : "–"}</b>
          </div>
        </div>
      ))}
    </div>
  );
}

export default App;