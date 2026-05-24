{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  # We only need the dev tools now, as the libraries are in your system
  buildInputs = with pkgs; [
    rustc
    cargo
    nodejs
    pkg-config
    gcc
    gnumake
    binutils
    python3
    which
    zlib
    webkitgtk_4_1.dev
    gtk3.dev
    openssl.dev
  ];

  shellHook = ''
    echo "Brew Boxes Dev Shell (System-Linked)!"
    echo "GStreamer Path: $GST_PLUGIN_SYSTEM_PATH_1_0"
  '';
}
