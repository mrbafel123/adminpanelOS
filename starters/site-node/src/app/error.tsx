'use client'

// Ядро недоступно, а страницы ещё нет в кеше. Посетитель видит понятное сообщение, а не 500.
export default function Error() {
  return (
    <main>
      <h1 className="page-title">Сайт обновляется</h1>
      <p>Страница скоро будет доступна. Попробуйте обновить её через минуту.</p>
      {process.env.NEXT_PUBLIC_CONTACT_PHONE && (
        <p>
          Если вопрос срочный — позвоните:{' '}
          <a href={`tel:${process.env.NEXT_PUBLIC_CONTACT_PHONE}`}>{process.env.NEXT_PUBLIC_CONTACT_PHONE}</a>
        </p>
      )}
      <p>
        <a href="/">На главную</a>
      </p>
    </main>
  )
}
