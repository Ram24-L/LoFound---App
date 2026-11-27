<!DOCTYPE html>
<html lang="id" translate="no">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <meta name="google" content="notranslate">
    <meta name="theme-color" content="#318FB5">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <meta name="apple-mobile-web-app-title" content="LoFound">
    <title>LoFound — KRL Lost & Found Platform</title>
    <link rel="manifest" href="/manifest.webmanifest">
    <link rel="shortcut icon" href="/favicon.ico?v=2">
    <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png?v=2">
    <link rel="icon" type="image/svg+xml" href="/icons/icon.svg?v=2">
    <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png?v=2">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    @if(!empty($paymentReturn))
        <script>window.__LOFOUND_PAYMENT_RETURN__ = @json($paymentReturn);</script>
    @endif
    @viteReactRefresh
    @vite(['resources/js/index.css', 'resources/js/main.tsx'])
</head>
<body>
    <div id="root"></div>
</body>
</html>
