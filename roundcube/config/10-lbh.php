<?php

/*
 * Surcharge Roundcube spécifique à la plateforme LBH.
 * Les réglages non sensibles sont récupérés dynamiquement depuis le backend
 * afin de refléter les modifications de l'administration sans redéploiement.
 */

function lbh_roundcube_public_config(): array
{
    $url = getenv('ROUNDCUBE_CONFIG_URL') ?: 'http://lbh-backend:8000/api/messagerie/roundcube/configuration/';
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

$lbh = lbh_roundcube_public_config();

$config['smtp_user'] = '%u';
$config['smtp_pass'] = '%p';
$config['des_key'] = getenv('ROUNDCUBE_DES_KEY') ?: 'lbh-roundcube-des-key';
$config['auto_create_user'] = true;
$config['login_autocomplete'] = 2;
$config['skin'] = 'elastic';
$config['enable_installer'] = false;
$config['display_product_info'] = 0;
$config['blankpage_url'] = $lbh['blankpage_url'] ?? '/api/messagerie/roundcube/watermark/';

if (!empty($lbh['imap_host'])) {
    $config['imap_host'] = $lbh['imap_host'];
}

if (!empty($lbh['smtp_host'])) {
    $config['smtp_host'] = $lbh['smtp_host'];
}

$config['sent_mbox'] = $lbh['sent_mbox'] ?? (getenv('ROUNDCUBE_SENT_MBOX') ?: 'INBOX.Sent');
$config['drafts_mbox'] = $lbh['drafts_mbox'] ?? (getenv('ROUNDCUBE_DRAFTS_MBOX') ?: 'INBOX.Drafts');
$config['junk_mbox'] = $lbh['junk_mbox'] ?? (getenv('ROUNDCUBE_JUNK_MBOX') ?: 'INBOX.Spam');
$config['trash_mbox'] = $lbh['trash_mbox'] ?? (getenv('ROUNDCUBE_TRASH_MBOX') ?: 'INBOX.Trash');
$config['archive_mbox'] = $lbh['archive_mbox'] ?? '';
$config['language'] = $lbh['language'] ?? 'fr_FR';
$config['support_url'] = $lbh['support_url'] ?? '';
$config['product_name'] = $lbh['product_name'] ?? 'Messagerie';

if (!empty($lbh['logo_url'])) {
    $config['skin_logo'] = [
        'elastic:login' => $lbh['logo_url'],
        'elastic:login[small]' => $lbh['logo_url'],
        'elastic:*' => $lbh['logo_url'],
        'elastic:*[small]' => $lbh['logo_url'],
        '[link]' => $lbh['logo_link'] ?? '/',
    ];
}
