<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'whatsapp' => [
        'url' => env('WHATSAPP_API_URL', 'https://api.fonnte.com/send'),
        'token' => env('WHATSAPP_API_TOKEN'),
    ],

    'midtrans' => [
        'server_key' => env('MIDTRANS_SERVER_KEY'),
        'client_key' => env('MIDTRANS_CLIENT_KEY'),
        'signature_key' => env('MIDTRANS_SIGNATURE_KEY'),
        'is_production' => (bool) env('MIDTRANS_IS_PRODUCTION', false),
        'override_amount' => env('PAYMENT_OVERRIDE_AMOUNT') ? (int) env('PAYMENT_OVERRIDE_AMOUNT') : null,
    ],

    'shipping' => [
        'api_url' => env('SHIPPING_API_URL'),
        'api_key' => env('SHIPPING_API_KEY'),
        'webhook_secret' => env('SHIPPING_WEBHOOK_SECRET'),
    ],

    'biteship' => [
        'api_key' => env('BITESHIP_API_KEY'),
        'base_url' => env('BITESHIP_BASE_URL', 'https://api.biteship.com/v1'),
        'origin_postal_code' => (int) env('BITESHIP_ORIGIN_POSTAL_CODE', 11110),
        'origin_address' => env('BITESHIP_ORIGIN_ADDRESS', 'Posko CS Stasiun Jakarta Kota, Jl. Stasiun Kota No.1, Pinangsia, Tamansari, Jakarta Barat'),
        'origin_name' => env('BITESHIP_ORIGIN_NAME', 'Posko CS LoFound KAI Commuter'),
        'origin_phone' => env('BITESHIP_ORIGIN_PHONE', '081212345678'),
        'couriers' => env('BITESHIP_COURIERS', 'jne,pos,jnt,sicepat,anteraja'),
    ],

];
