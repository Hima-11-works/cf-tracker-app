type ChartProblem = {
  section: string;
  rating: number | null;
  status: "not_attempted" | "accepted" | "tle_mle" | "wrong_answer";
};

type TopicProgress = {
  section: string;
  accepted: number;
  total: number;
  percent: number;
};

type RatingSlice = {
  label: string;
  color: string;
  count: number;
};

const RATING_COLORS = [
  "var(--chart-blue)",
  "var(--chart-cyan)",
  "var(--chart-violet)",
  "var(--chart-green)",
  "var(--chart-yellow)",
  "var(--chart-muted)",
] as const;

const RADAR_CENTER_X = 210;
const RADAR_CENTER_Y = 145;
const RADAR_RADIUS = 100;

function radarPoint(index: number, count: number, radius: number) {
  const angle = -Math.PI / 2 + (2 * Math.PI * index) / count;
  return {
    x: RADAR_CENTER_X + Math.cos(angle) * radius,
    y: RADAR_CENTER_Y + Math.sin(angle) * radius,
  };
}

function pointList(points: Array<{ x: number; y: number }>) {
  return points.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
}

function piePoint(angle: number, radius: number) {
  return {
    x: 110 + Math.cos(angle) * radius,
    y: 110 + Math.sin(angle) * radius,
  };
}

function pieSlicePath(startAngle: number, endAngle: number) {
  const radius = 88;
  const start = piePoint(startAngle, radius);
  const end = piePoint(endAngle, radius);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M 110 110 L ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)} Z`;
}

function TopicRadar({ topics }: { topics: TopicProgress[] }) {
  const gridLevels = [20, 40, 60, 80, 100];
  const topicPoints = topics.map((topic, index) => radarPoint(index, topics.length, RADAR_RADIUS * topic.percent / 100));
  const gridPoints = (level: number) => pointList(topics.map((_, index) => radarPoint(index, topics.length, RADAR_RADIUS * level / 100)));
  const description = topics.map((topic) => `${topic.section}: ${topic.accepted} of ${topic.total} accepted, ${topic.percent} percent`).join(". ");

  return (
    <div className="topic-chart-layout">
      <svg className="topic-radar" viewBox="0 0 420 290" role="img" aria-labelledby="topic-radar-title topic-radar-description">
        <title id="topic-radar-title">Accepted share by topic</title>
        <desc id="topic-radar-description">Radar chart with a zero to one hundred percent scale. {description}</desc>
        {gridLevels.map((level) => (
          topics.length >= 3 ? (
            <polygon key={level} className="radar-grid" points={gridPoints(level)} />
          ) : (
            <circle key={level} className="radar-grid" cx={RADAR_CENTER_X} cy={RADAR_CENTER_Y} r={RADAR_RADIUS * level / 100} />
          )
        ))}
        {topics.map((topic, index) => {
          const outer = radarPoint(index, topics.length, RADAR_RADIUS);
          return <line key={`axis-${topic.section}`} className="radar-axis" x1={RADAR_CENTER_X} y1={RADAR_CENTER_Y} x2={outer.x} y2={outer.y} />;
        })}
        {topics.length >= 3 ? (
          <polygon className="radar-area" points={pointList(topicPoints)} />
        ) : topics.length === 2 ? (
          <polyline className="radar-outline" points={pointList(topicPoints)} />
        ) : null}
        {topicPoints.map((point, index) => (
          <circle key={`point-${topics[index].section}`} className="radar-point" cx={point.x} cy={point.y} r="4" />
        ))}
        {topics.map((topic, index) => {
          const label = radarPoint(index, topics.length, RADAR_RADIUS + 20);
          return <text key={`label-${topic.section}`} className="radar-index" x={label.x} y={label.y}>{index + 1}</text>;
        })}
      </svg>

      <ol className="topic-progress-key" aria-label="Accepted problems by topic">
        {topics.map((topic, index) => (
          <li className="topic-progress-item" key={topic.section}>
            <span className="topic-progress-index">{index + 1}</span>
            <span className="topic-progress-name">{topic.section}</span>
            <span className="topic-progress-value">{topic.accepted}/{topic.total} · {topic.percent}%</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function RatingPie({ ratings, total }: { ratings: RatingSlice[]; total: number }) {
  const visibleRatings = ratings.filter((rating) => rating.count > 0);
  let accumulated = 0;
  const slices = visibleRatings.map((rating) => {
    const start = -Math.PI / 2 + (2 * Math.PI * accumulated) / total;
    accumulated += rating.count;
    const end = -Math.PI / 2 + (2 * Math.PI * accumulated) / total;
    return { ...rating, start, end };
  });
  const description = visibleRatings.map((rating) => `${rating.label}: ${rating.count}`).join(". ");

  return (
    <div className="rating-chart-layout">
      <svg className="rating-pie" viewBox="0 0 220 220" role="img" aria-labelledby="rating-pie-title rating-pie-description">
        <title id="rating-pie-title">Accepted problems by rating</title>
        <desc id="rating-pie-description">Pie chart of {total} accepted problems with a rating, grouped by exact Codeforces rating. {description || "No accepted problems with a rating yet."}</desc>
        {total === 0 ? <circle className="rating-pie-empty" cx="110" cy="110" r="88" /> : null}
        {slices.length === 1 ? <circle cx="110" cy="110" r="88" fill={slices[0].color} /> : null}
        {slices.length > 1 ? slices.map((slice) => (
          <path key={slice.label} className="rating-slice" fill={slice.color} d={pieSlicePath(slice.start, slice.end)} />
        )) : null}
      </svg>

      {total > 0 ? (
        <ul className="rating-key" aria-label="Accepted problems by exact rating">
          {visibleRatings.map((rating) => (
            <li className="rating-key-item" key={rating.label}>
              <span className="rating-swatch" style={{ backgroundColor: rating.color }} aria-hidden="true" />
              <span className="rating-key-label">{rating.label}</span>
              <span className="rating-key-count">{rating.count} · {Math.round((rating.count / total) * 100)}%</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rating-chart-empty">No accepted problems with a rating yet.</p>
      )}
    </div>
  );
}
export function ProgressCharts({ problems }: { problems: ChartProblem[] }) {
  if (problems.length === 0) return null;

  const topicCounts = new Map<string, { accepted: number; total: number }>();
  for (const problem of problems) {
    const progress = topicCounts.get(problem.section) ?? { accepted: 0, total: 0 };
    progress.total += 1;
    if (problem.status === "accepted") progress.accepted += 1;
    topicCounts.set(problem.section, progress);
  }
  const topics = [...topicCounts.entries()].map(([section, counts]) => ({
    section,
    ...counts,
    percent: Math.round((counts.accepted / counts.total) * 100),
  }));

  const ratingCounts = new Map<string, number>();
  for (const problem of problems) {
    if (problem.status !== "accepted") continue;
    if (problem.rating === null || !Number.isFinite(problem.rating)) continue;
    const label = String(problem.rating);
    ratingCounts.set(label, (ratingCounts.get(label) ?? 0) + 1);
  }
  const ratingSlices = [...ratingCounts.entries()]
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([label, count], index) => ({ label, count, color: RATING_COLORS[index % RATING_COLORS.length] }));
  const solvedCount = ratingSlices.reduce((total, rating) => total + rating.count, 0);

  return (
    <section className="progress-charts" aria-label="Probation sheet progress charts">
      <section className="progress-chart-card" aria-labelledby="topic-progress-heading">
        <div className="progress-chart-heading">
          <div>
            <h3 id="topic-progress-heading">Topic progress</h3>
            <p>Accepted share of problems in each section</p>
          </div>
          <span className="chart-meta">0–100%</span>
        </div>
        <TopicRadar topics={topics} />
      </section>

      <section className="progress-chart-card" aria-labelledby="rating-progress-heading">
        <div className="progress-chart-heading">
          <div>
            <h3 id="rating-progress-heading">Solved by rating</h3>
            <p>Accepted problems grouped by exact rating</p>
          </div>
          <span className="chart-meta">{solvedCount} rated</span>
        </div>
        <RatingPie ratings={ratingSlices} total={solvedCount} />
      </section>
    </section>
  );
}
