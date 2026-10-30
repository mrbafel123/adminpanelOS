// Редирект в статическом режиме: на хостинге без Node сервер не отдаст 301,
// поэтому по старому адресу лежит страница, которая сразу уводит на новый.
export const RedirectStub = ({ to }: { to: string }) => (
  <main>
    <meta httpEquiv="refresh" content={`0; url=${to}`} />
    <link rel="canonical" href={to} />
    <p>
      Страница переехала: <a href={to}>{to}</a>
    </p>
  </main>
)
