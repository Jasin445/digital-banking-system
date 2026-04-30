const welcomePage = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Digital Banking System</title>
      <style>
        body {
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          background: linear-gradient(135deg, #0f172a, #1e293b);
          color: #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
        }

        .card {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 40px;
          width: 90%;
          max-width: 500px;
        }

        h1 {
          margin-top: 0;
          font-size: 28px;
          text-align: center;
          background: linear-gradient(90deg, #38bdf8, #6366f1);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .item {
          margin: 15px 0;
          padding: 12px 15px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.05);
          display: flex;
          justify-content: space-between;
        }

        .label {
          font-weight: 600;
          color: #94a3b8;
        }

        .value {
          font-weight: 500;
        }

        .motto {
          margin-top: 25px;
          text-align: center;
          font-style: italic;
          color: #38bdf8;
        }

        .status {
          text-align: center;
          margin-bottom: 20px;
          font-size: 14px;
          color: #22c55e;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="status">● API is running</div>
        <h1>Digital Banking System</h1>

        <div class="item">
          <span class="label">Author</span>
          <span class="value">Jason Dagana</span>
        </div>

        <div class="item">
          <span class="label">Cohort</span>
          <span class="value">Novara Cohort</span>
        </div>

        <div class="item">
          <span class="label">Course</span>
          <span class="value">Software Development</span>
        </div>

        <div class="motto">
          "We rise together with others!!"
        </div>
      </div>
    </body>
    </html>
  `

module.exports = welcomePage;