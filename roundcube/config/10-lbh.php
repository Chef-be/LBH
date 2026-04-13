<?php

/*
 * Surcharge Roundcube spécifique à la plateforme LBH.
 * Les réglages non sensibles sont récupérés dynamiquement depuis le backend
 * afin de refléter les modifications de l'administration sans redéploiement.
 */

if (!function_exists('lbh_roundcube_public_config')) {
    function lbh_roundcube_public_config(): array
    {
        $urls = [];
        $url_env = getenv('ROUNDCUBE_CONFIG_URL');

        if ($url_env) {
            $urls[] = $url_env;
        }

        $prefixe = getenv('PREFIXE_CONTENEURS') ?: 'lbh';

        $urls[] = sprintf('http://%s-backend:8000/api/messagerie/roundcube/configuration/', $prefixe);
        $urls[] = 'http://lbh-backend:8000/api/messagerie/roundcube/configuration/';
        $urls[] = 'http://bee-backend:8000/api/messagerie/roundcube/configuration/';

        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'timeout' => 2,
                'ignore_errors' => true,
            ],
        ]);

        foreach (array_values(array_unique(array_filter($urls))) as $url) {
            $raw = @file_get_contents($url, false, $context);
            if (!$raw) {
                continue;
            }

            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }

        return [];
    }
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
$config['use_https'] = true;
$config['session_name'] = 'lbh_roundcube_sessid';
$config['session_auth_name'] = 'lbh_roundcube_sessauth';
$config['session_path'] = '/roundcube/';
$config['session_samesite'] = 'Lax';
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
$config['product_name'] = $lbh['product_name'] ?? 'Webmail';

if (!empty($lbh['logo_url'])) {
    $config['skin_logo'] = [
        'elastic:login' => $lbh['logo_url'],
        'elastic:login[small]' => $lbh['logo_url'],
        'elastic:*' => $lbh['logo_url'],
        'elastic:*[small]' => $lbh['logo_url'],
        '[link]' => $lbh['logo_link'] ?? '/roundcube/?_task=mail',
    ];
}
