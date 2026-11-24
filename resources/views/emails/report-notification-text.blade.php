LoFound - KAI Commuter Lost & Found
{{ $title }}@if($reportCode) (#{{ $reportCode }})@endif

Halo {{ $recipientName ?? 'Penumpang' }},

{{ $body }}

--- Ringkasan Laporan ---
@if($reportCode)Kode Laporan   : #{{ $reportCode }}
@endif
@if($itemName)Barang         : {{ $itemName }}
@endif
@if($routeLabel)Rute / Stasiun : {{ $routeLabel }}
@endif
@if($statusLabel)Status Terkini : {{ $statusLabel }}
@endif
@foreach($details as $label => $value)
@if($value !== null && $value !== ''){{ $label }} : {{ $value }}
@endif
@endforeach
@if($actionUrl)

{{ $actionText }}: {{ $actionUrl }}
@endif

--
Notifikasi ini dikirim karena pengingat email diaktifkan pada laporan kehilangan Anda di LoFound — KAI Commuter.
