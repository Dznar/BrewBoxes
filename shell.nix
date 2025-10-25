{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  name = "node-pty-dev-shell";

  buildInputs = with pkgs; [
    python3
    gcc
    gnumake
    pkg-config
    zlib
    zlib.dev
    openssl
    which
  ];

  # Ensure npm uses the provided python for node-gyp

}
