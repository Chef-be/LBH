<?php

/*
 * Surcharge Roundcube spécifique à la plateforme BEE.
 * Les réglages non sensibles sont récupérés dynamiquement depuis le backend
 * afin de refléter les modifications de l'administration sans redéploiement.
 */

function bee_roundcube_public_config(): array
{
    $url = getenv('ROUNDCUBE_CONFIG_URL') ?: 'http://bee-backend:8000/api/messagerie/roundcube/configuration/';
    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 2,
            'ignore_errors' => true,
        ],
    ]);

    $raw = @file_get_contents($url, false, $context);
    if (!$raw) {
        return [];
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

$bee = bee_roundcube_public_config();

$config['smtp_user'] = '%u';
$config['smtp_pass'] = '%p';
$config['des_key'] = getenv('ROUNDCUBE_DES_KEY') ?: 'bee-roundcube-des-key';
$config['auto_create_user'] = true;
$config['login_autocomplete'] = 2;
$config['skin'] = 'elastic';
$config['enable_installer'] = false;
$config['display_product_info'] = 0;
$config['blankpage_url'] = $bee['blankpage_url'] ?? '/api/messagerie/roundcube/watermark/';

if (!empty($bee['imap_host'])) {
    $config['imap_host'] = $bee['imap_host'];
}

if (!empty($bee['smtp_host'])) {
    $config['smtp_host'] = $bee['smtp_host'];
}

$config['sent_mbox'] = $bee['sent_mbox'] ?? (getenv('ROUNDCUBE_SENT_MBOX') ?: 'INBOX.Sent');
$config['drafts_mbox'] = $bee['drafts_mbox'] ?? (getenv('ROUNDCUBE_DRAFTS_MBOX') ?: 'INBOX.Drafts');
$config['junk_mbox'] = $bee['junk_mbox'] ?? (getenv('ROUNDCUBE_JUNK_MBOX') ?: 'INBOX.Spam');
$config['trash_mbox'] = $bee['trash_mbox'] ?? (getenv('ROUNDCUBE_TRASH_MBOX') ?: 'INBOX.Trash');
$config['archive_mbox'] = $bee['archive_mbox'] ?? '';
$config['language'] = $bee['language'] ?? 'fr_FR';
$config['support_url'] = $bee['support_url'] ?? '';
$config['product_name'] = $bee['product_name'] ?? 'Messagerie';

if (!empty($bee['logo_url'])) {
    $config['skin_logo'] = [
        'elastic:login' => $bee['logo_url'],
        'elastic:login[small]' => $bee['logo_url'],
        'elastic:*' => $bee['logo_url'],
        'elastic:*[small]' => $bee['logo_url'],
        '[link]' => $bee['logo_link'] ?? '/',
    ];
}
